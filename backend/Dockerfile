FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
RUN go build -o /out/powerwindow-api ./cmd/server

FROM alpine:3.20

WORKDIR /app
RUN adduser -D -H appuser
COPY --from=build /out/powerwindow-api /app/powerwindow-api
RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

ENV PORT=8080
ENV CACHE_PATH=/app/data/market-cache.json
EXPOSE 8080

CMD ["/app/powerwindow-api"]
