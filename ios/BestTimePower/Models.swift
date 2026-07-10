import Foundation

struct PricePoint: Identifiable, Hashable {
    var id: Int { hour }
    let hour: Int
    let price: Double
}

struct PowerWindow: Identifiable, Hashable {
    var id: Int { start }
    let start: Int
    let duration: Int
    let averagePrice: Double
    let cost: Double
    let score: Double
    let hours: [Int]

    var label: String {
        "\(Self.formatHour(start))-\(Self.formatHour(start + duration))"
    }

    private static func formatHour(_ value: Int) -> String {
        let normalized = ((value % 24) + 24) % 24
        let suffix = normalized >= 12 ? "PM" : "AM"
        let hour = normalized % 12 == 0 ? 12 : normalized % 12
        return "\(hour) \(suffix)"
    }
}

struct Appliance: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let kilowatts: Double

    static let presets = [
        Appliance(name: "Dishwasher", kilowatts: 0.8),
        Appliance(name: "Washing machine", kilowatts: 1.2),
        Appliance(name: "Dryer", kilowatts: 2.2),
        Appliance(name: "Air conditioner", kilowatts: 1.2),
        Appliance(name: "EV slow charge", kilowatts: 3.7),
        Appliance(name: "Heat pump", kilowatts: 1.5)
    ]
}

struct AppState {
    var points: [PricePoint] = []
    var windows: [PowerWindow] = []
    var source: DataSource = .loading
    var lastUpdated: String?
}

enum DataSource {
    case loading
    case api
    case demo
    case failed
}
