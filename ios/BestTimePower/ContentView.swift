import SwiftUI

struct ContentView: View {
    @State private var selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
    @State private var duration = 2.0
    @State private var appliance = Appliance.presets[0]
    @State private var appState = AppState()

    private let client = REEClient()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    controls
                    hero
                    metrics
                    chart
                    rankedWindows
                    sourceNote
                }
                .padding(18)
            }
            .background(
                LinearGradient(
                    colors: [Color(red: 0.95, green: 0.97, blue: 0.94), .white],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .navigationTitle("Power Window")
            .task { await load() }
            .refreshable { await load() }
            .onChange(of: selectedDate) { _, _ in Task { await load() } }
            .onChange(of: duration) { _, _ in recompute() }
            .onChange(of: appliance) { _, _ in recompute() }
        }
    }

    private var controls: some View {
        VStack(spacing: 12) {
            DatePicker("Date", selection: $selectedDate, displayedComponents: .date)

            HStack {
                Picker("Load", selection: $appliance) {
                    ForEach(Appliance.presets) { preset in
                        Text(preset.name).tag(preset)
                    }
                }
                .pickerStyle(.menu)

                Stepper("\(Int(duration))h", value: $duration, in: 1...8, step: 1)
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var hero: some View {
        let best = appState.windows.first

        return VStack(alignment: .leading, spacing: 14) {
            Text(sourceLabel.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.65))

            Text(best == nil ? "Loading REE data..." : "Use power \(best!.label)")
                .font(.system(size: 44, weight: .black, design: .rounded))
                .minimumScaleFactor(0.65)
                .foregroundStyle(.white)

            Text(bestReason)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.08, blue: 0.07), Color(red: 0.02, green: 0.42, blue: 0.33)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 30, style: .continuous)
        )
    }

    private var metrics: some View {
        let best = appState.windows.first
        let worst = appState.windows.last

        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricTile(title: "Timing grade", value: best.map { grade(for: $0.score) } ?? "--", caption: best.map { "Score \(Int($0.score.rounded()))" } ?? "Best slot")
            MetricTile(title: "Load label", value: loadLabel(for: appliance.kilowatts * duration), caption: "\(appliance.kilowatts * duration, specifier: "%.1f") kWh run")
            MetricTile(title: "Cost", value: best.map { money($0.cost) } ?? "--", caption: "\(appliance.kilowatts, specifier: "%.1f") kW")
            MetricTile(title: "Avoid", value: worst?.label ?? "--", caption: "Highest window")
        }
    }

    private var chart: some View {
        let bestHours = Set(appState.windows.first?.hours ?? [])
        let maxPrice = appState.points.map(\.price).max() ?? 1

        return VStack(alignment: .leading, spacing: 12) {
            Text("Hourly price signal")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .bottom, spacing: 7) {
                    ForEach(appState.points) { point in
                        VStack(spacing: 6) {
                            Capsule()
                                .fill(bestHours.contains(point.hour) ? Color(red: 0, green: 0.66, blue: 0.52) : Color(red: 0.36, green: 0.55, blue: 0.94))
                                .frame(width: 16, height: max(18, CGFloat(point.price / maxPrice) * 154))

                            Text(String(format: "%02d", point.hour))
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(height: 190)
                .padding(.horizontal, 4)
            }
        }
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var rankedWindows: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Best starts")
                .font(.headline)

            ForEach(appState.windows.prefix(5)) { window in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(window.label)
                            .font(.headline)
                        Text("\(price(window.averagePrice)) average")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Text(money(window.cost))
                        .font(.headline)
                }
                .padding(14)
                .background(Color(red: 0.97, green: 0.99, blue: 0.95), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private var sourceNote: some View {
        Text("Source: Red Electrica de Espana REData API. Independent app; not affiliated with or endorsed by Red Electrica. Market prices are signals, not a complete bill.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sourceLabel: String {
        switch appState.source {
        case .api:
            return "Live REE data"
        case .demo:
            return "Demo mode"
        case .failed:
            return "Offline"
        case .loading:
            return "Connecting"
        }
    }

    private var bestReason: String {
        guard let best = appState.windows.first, let worst = appState.windows.last, worst.cost > 0 else {
            return "Fetching Spain market price data and ranking the best window."
        }

        let percent = max(0, (worst.cost - best.cost) / worst.cost * 100)
        let prefix = appState.source == .api ? "Based on REE market data." : "Using demo prices because REE data was unavailable."
        return "\(prefix) This window is about \(Int(percent.rounded()))% cheaper than the most expensive comparable window."
    }

    private func load() async {
        await MainActor.run { appState.source = .loading }
        do {
            let result = try await client.fetchPrices(for: selectedDate)
            await MainActor.run {
                appState.points = result.points
                appState.lastUpdated = result.lastUpdated
                appState.source = .api
                recompute()
            }
        } catch {
            await MainActor.run {
                appState.points = REEClient.demoPrices(for: selectedDate)
                appState.lastUpdated = nil
                appState.source = .demo
                recompute()
            }
        }
    }

    private func recompute() {
        appState.windows = REEClient.rankWindows(
            points: appState.points,
            duration: Int(duration),
            kilowatts: appliance.kilowatts
        )
    }

    private func money(_ value: Double) -> String {
        value.formatted(.currency(code: "EUR").precision(.fractionLength(2)))
    }

    private func price(_ value: Double) -> String {
        "\(Int(value.rounded())) EUR/MWh"
    }

    private func grade(for score: Double) -> String {
        if score >= 90 { return "A" }
        if score >= 78 { return "B" }
        if score >= 64 { return "C" }
        if score >= 50 { return "D" }
        if score >= 35 { return "E" }
        return "F"
    }

    private func loadLabel(for kWh: Double) -> String {
        if kWh <= 1 { return "A" }
        if kWh <= 2 { return "B" }
        if kWh <= 3.5 { return "C" }
        if kWh <= 5 { return "D" }
        if kWh <= 7.5 { return "E" }
        if kWh <= 11 { return "F" }
        return "G"
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.black))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(caption)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
