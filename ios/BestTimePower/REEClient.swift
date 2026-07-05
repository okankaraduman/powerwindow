import Foundation

final class REEClient {
    private let baseURL = URL(string: "https://apidatos.ree.es/en/datos/mercados/precios-mercados-tiempo-real")!

    func fetchPrices(for date: Date) async throws -> (points: [PricePoint], lastUpdated: String?) {
        let calendar = Calendar(identifier: .gregorian)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        let day = formatter.string(from: date)
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "start_date", value: "\(day)T00:00"),
            URLQueryItem(name: "end_date", value: "\(day)T23:59"),
            URLQueryItem(name: "time_trunc", value: "hour")
        ]

        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoded = try JSONDecoder().decode(REEResponse.self, from: data)
        if decoded.errors?.isEmpty == false {
            throw URLError(.cannotParseResponse)
        }

        let series = decoded.included?.first { item in
            let title = "\(item.type ?? "") \(item.attributes.title ?? "")".lowercased()
            return title.contains("pvpc")
        } ?? decoded.included?.first { item in
            let title = "\(item.type ?? "") \(item.attributes.title ?? "")".lowercased()
            return title.contains("spot market price")
        }

        guard let values = series?.attributes.values, !values.isEmpty else {
            throw URLError(.cannotParseResponse)
        }

        var buckets: [Int: (total: Double, count: Double)] = [:]
        for value in values {
            guard let hour = Self.hour(from: value.datetime) else { continue }
            let current = buckets[hour] ?? (0, 0)
            buckets[hour] = (current.total + value.value, current.count + 1)
        }

        let points = (0..<24).compactMap { hour -> PricePoint? in
            guard let bucket = buckets[hour], bucket.count > 0 else { return nil }
            return PricePoint(hour: hour, price: bucket.total / bucket.count)
        }

        return (points, decoded.data.attributes.lastUpdate)
    }

    static func rankWindows(points: [PricePoint], duration: Int, kilowatts: Double) -> [PowerWindow] {
        guard !points.isEmpty else { return [] }

        let prices = points.map(\.price)
        let minPrice = prices.min() ?? 0
        let maxPrice = prices.max() ?? 1
        let range = max(maxPrice - minPrice, 1)
        let maxStart = max(0, points.count - duration)

        return (0...maxStart).map { start in
            let slice = Array(points[start..<(start + duration)])
            let average = slice.map(\.price).reduce(0, +) / Double(slice.count)
            let cost = slice.reduce(0) { $0 + ($1.price / 1000) * kilowatts }
            let priceScore = 100 - ((average - minPrice) / range) * 100
            let middayBonus = slice.contains { (10...17).contains($0.hour) } ? 4.0 : 0

            return PowerWindow(
                start: start,
                duration: duration,
                averagePrice: average,
                cost: cost,
                score: min(100, max(0, priceScore + middayBonus)),
                hours: slice.map(\.hour)
            )
        }
        .sorted {
            if $0.averagePrice == $1.averagePrice { return $0.start < $1.start }
            return $0.averagePrice < $1.averagePrice
        }
    }

    static func demoPrices(for date: Date) -> [PricePoint] {
        let seed = Calendar.current.ordinality(of: .day, in: .era, for: date) ?? 1
        return (0..<24).map { hour in
            let morning = (7...9).contains(hour) ? 42.0 : 0
            let evening = (20...23).contains(hour) ? 75.0 : 0
            let solarDip = (10...17).contains(hour) ? -48.0 : 0
            let nightDip = (1...5).contains(hour) ? -18.0 : 0
            let wave = sin(Double(hour + seed) * 0.8) * 10
            return PricePoint(hour: hour, price: max(0, 92 + morning + evening + solarDip + nightDip + wave))
        }
    }

    private static func hour(from datetime: String) -> Int? {
        guard let range = datetime.range(of: #"T(\d{2}):"#, options: .regularExpression) else {
            return nil
        }
        let value = datetime[range].dropFirst().dropLast()
        return Int(value)
    }
}

private struct REEResponse: Decodable {
    let data: REEData
    let included: [REEIncluded]?
    let errors: [REEError]?
}

private struct REEData: Decodable {
    let attributes: REEAttributes
}

private struct REEIncluded: Decodable {
    let type: String?
    let attributes: REEAttributes
}

private struct REEAttributes: Decodable {
    let title: String?
    let values: [REEValue]?
    let lastUpdate: String?

    enum CodingKeys: String, CodingKey {
        case title
        case values
        case lastUpdate = "last-update"
    }
}

private struct REEValue: Decodable {
    let value: Double
    let datetime: String
}

private struct REEError: Decodable {
    let detail: String?
}
