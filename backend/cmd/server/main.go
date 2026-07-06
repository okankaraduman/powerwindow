package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const marketWidget = "mercados/precios-mercados-tiempo-real"

type config struct {
	addr           string
	cachePath      string
	allowedOrigins []string
	reeBaseURL     string
	timezone       *time.Location
}

type server struct {
	cfg    config
	client *http.Client
	cache  *cacheStore
}

type cacheStore struct {
	mu      sync.Mutex
	path    string
	entries map[string]cacheEntry
}

type cacheEntry struct {
	CachedAt time.Time       `json:"cachedAt"`
	Payload  json.RawMessage `json:"payload"`
}

type apiResponse struct {
	Source      string          `json:"source"`
	CacheStatus string          `json:"cacheStatus"`
	CachedAt    *time.Time      `json:"cachedAt,omitempty"`
	Payload     json.RawMessage `json:"payload"`
}

func main() {
	cfg := loadConfig()
	store, err := newCacheStore(cfg.cachePath)
	if err != nil {
		log.Fatalf("cache init: %v", err)
	}

	srv := &server{
		cfg: cfg,
		client: &http.Client{
			Timeout: 12 * time.Second,
		},
		cache: store,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/api/market", srv.withCORS(srv.handleMarket))

	log.Printf("powerwindow backend listening on %s", cfg.addr)
	if err := http.ListenAndServe(cfg.addr, mux); err != nil {
		log.Fatal(err)
	}
}

func loadConfig() config {
	tz, err := time.LoadLocation(env("TIMEZONE", "Europe/Madrid"))
	if err != nil {
		tz = time.FixedZone("Europe/Madrid", 2*60*60)
	}

	origins := strings.Split(env("ALLOWED_ORIGINS", "*"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return config{
		addr:           ":" + env("PORT", "8080"),
		cachePath:      env("CACHE_PATH", "data/market-cache.json"),
		allowedOrigins: origins,
		reeBaseURL:     env("REE_BASE_URL", "https://apidatos.ree.es/en/datos"),
		timezone:       tz,
	}
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) handleMarket(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	dateValue := r.URL.Query().Get("date")
	if dateValue == "" {
		writeError(w, http.StatusBadRequest, "missing date")
		return
	}

	date, err := time.ParseInLocation("2006-01-02", dateValue, s.cfg.timezone)
	if err != nil {
		writeError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}

	if err := s.validateDate(date); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	key := date.Format("2006-01-02")
	forceRefresh := r.URL.Query().Get("refresh") == "1"

	if !forceRefresh {
		if entry, ok := s.cache.getFresh(key, s.ttlForDate(date)); ok {
			writeJSON(w, http.StatusOK, apiResponse{
				Source:      "ree",
				CacheStatus: "hit",
				CachedAt:    &entry.CachedAt,
				Payload:     entry.Payload,
			})
			return
		}
	}

	payload, err := s.fetchREE(r.Context(), date)
	if err != nil {
		if entry, ok := s.cache.getAny(key); ok {
			writeJSON(w, http.StatusOK, apiResponse{
				Source:      "ree",
				CacheStatus: "stale",
				CachedAt:    &entry.CachedAt,
				Payload:     entry.Payload,
			})
			return
		}
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	entry := cacheEntry{CachedAt: time.Now().UTC(), Payload: payload}
	if err := s.cache.set(key, entry); err != nil {
		log.Printf("cache write failed: %v", err)
	}

	writeJSON(w, http.StatusOK, apiResponse{
		Source:      "ree",
		CacheStatus: "miss",
		CachedAt:    &entry.CachedAt,
		Payload:     payload,
	})
}

func (s *server) validateDate(date time.Time) error {
	today := startOfDay(time.Now().In(s.cfg.timezone))
	tomorrow := today.AddDate(0, 0, 1)
	if date.After(tomorrow) {
		return errors.New("REE day-ahead data is only available through tomorrow")
	}
	return nil
}

func (s *server) ttlForDate(date time.Time) time.Duration {
	today := startOfDay(time.Now().In(s.cfg.timezone))
	tomorrow := today.AddDate(0, 0, 1)

	switch {
	case sameDay(date, tomorrow):
		return 15 * time.Minute
	case sameDay(date, today):
		return 30 * time.Minute
	case date.Before(today):
		return 30 * 24 * time.Hour
	default:
		return 5 * time.Minute
	}
}

func (s *server) fetchREE(ctx context.Context, date time.Time) (json.RawMessage, error) {
	start := date.Format("2006-01-02") + "T00:00"
	end := date.Format("2006-01-02") + "T23:59"

	endpoint, err := url.Parse(strings.TrimRight(s.cfg.reeBaseURL, "/") + "/" + marketWidget)
	if err != nil {
		return nil, err
	}

	query := endpoint.Query()
	query.Set("start_date", start)
	query.Set("end_date", end)
	query.Set("time_trunc", "hour")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PowerWindow/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("REE returned HTTP %d", resp.StatusCode)
	}

	if !json.Valid(body) {
		return nil, errors.New("REE returned invalid JSON")
	}

	return json.RawMessage(body), nil
}

func newCacheStore(path string) (*cacheStore, error) {
	store := &cacheStore{
		path:    path,
		entries: map[string]cacheEntry{},
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err == nil && len(data) > 0 {
		if err := json.Unmarshal(data, &store.entries); err != nil {
			return nil, err
		}
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	return store, nil
}

func (c *cacheStore) getFresh(key string, ttl time.Duration) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok || time.Since(entry.CachedAt) > ttl {
		return cacheEntry{}, false
	}
	return entry, true
}

func (c *cacheStore) getAny(key string) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	return entry, ok
}

func (c *cacheStore) set(key string, entry cacheEntry) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = entry
	return c.writeLocked()
}

func (c *cacheStore) writeLocked() error {
	data, err := json.MarshalIndent(c.entries, "", "  ")
	if err != nil {
		return err
	}

	tmp := c.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, c.path)
}

func (s *server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowed := s.allowedOrigin(origin); allowed != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowed)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		next(w, r)
	}
}

func (s *server) allowedOrigin(origin string) string {
	if origin == "" {
		return "*"
	}
	for _, allowed := range s.cfg.allowedOrigins {
		if allowed == "*" || allowed == origin {
			if allowed == "*" {
				return "*"
			}
			return origin
		}
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response failed: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func sameDay(a, b time.Time) bool {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return ay == by && am == bm && ad == bd
}
