import Foundation

/// One meal from the prototype's `meals` array.
struct Meal: Codable, Identifiable, Hashable {
    var name: String
    var slot: String
    var duration: Int
    var meta: String
    var cal: Int
    var img: String
    var ingredients: [String]
    var steps: [String]
    var nut: [String]?
    var fit: String?
    var culture: String?
    var fits: [String]?

    var id: String { name }
    var imageURL: URL? { URL(string: img) }
}

/// A meal together with its position in the library — the prototype passes
/// that index to `openMeal(i)`, `addToWeek(i)` and friends.
struct MealRef: Identifiable, Hashable {
    var index: Int
    var meal: Meal
    var id: Int { index }
}

/// One entry of `V17_WORLDS`.
struct WorldInfo: Codable, Hashable {
    var region: String
    var tag: String
    var img: String
    var description: String

    var imageURL: URL? { URL(string: img) }
}

/// One row of `WORLD_COUNTRIES`: [name, region, [3 areas], [3 foods]].
struct Country: Identifiable, Hashable {
    var name: String
    var region: String
    var areas: [String]
    var foods: [String]

    var id: String { name }
}

/// One row of `worlds`: [title, subtitle, image].
struct WorldTile: Identifiable, Hashable {
    var title: String
    var subtitle: String
    var img: String

    var id: String { title }
    var imageURL: URL? { URL(string: img) }
}

/// A nutrient contribution bar, from `V17_NUTRIENTS`.
struct NutrientBar: Hashable {
    var name: String
    var percent: Int
}

/// The prototype's data, loaded verbatim from `Resources/data.json`
/// (generated from the constants in the HTML file, so every string and every
/// image URL is identical to the web experience).
final class NourishData {
    static let shared = NourishData()

    let meals: [Meal]
    let nutrients: [String: [NutrientBar]]
    let worlds: [String: WorldInfo]
    let countries: [Country]
    let freeFeatured: [String]
    let continents: [String]
    let continentMap: [String: [String]]
    let worldTiles: [WorldTile]

    private struct Payload: Decodable {
        var meals: [Meal]
        var V17_NUTRIENTS: [String: [[NutrientValue]]]
        var V17_WORLDS: [String: WorldInfo]
        var WORLD_COUNTRIES: [[CountryField]]
        var WORLD_FREE_FEATURED: [String]
        var WORLD_CONTINENTS: [String]
        var WORLD_CONTINENT_MAP: [String: [String]]
        var worlds: [[String]]
    }

    /// `[['Protein', 28], ...]` — a mixed string/number JSON tuple.
    private enum NutrientValue: Decodable {
        case text(String)
        case number(Int)

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let n = try? c.decode(Int.self) {
                self = .number(n)
            } else {
                self = .text((try? c.decode(String.self)) ?? "")
            }
        }

        var stringValue: String {
            switch self {
            case .text(let s): return s
            case .number(let n): return String(n)
            }
        }

        var intValue: Int {
            switch self {
            case .text(let s): return Int(s) ?? 0
            case .number(let n): return n
            }
        }
    }

    /// `['Ghana', 'West Africa', [...], [...]]` — a mixed string/array tuple.
    private enum CountryField: Decodable {
        case text(String)
        case list([String])

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) {
                self = .text(s)
            } else {
                self = .list((try? c.decode([String].self)) ?? [])
            }
        }

        var stringValue: String {
            if case .text(let s) = self { return s }
            return ""
        }

        var listValue: [String] {
            if case .list(let l) = self { return l }
            return []
        }
    }

    private init() {
        guard
            let url = Bundle.main.url(forResource: "data", withExtension: "json"),
            let raw = try? Data(contentsOf: url),
            let payload = try? JSONDecoder().decode(Payload.self, from: raw)
        else {
            meals = []
            nutrients = [:]
            worlds = [:]
            countries = []
            freeFeatured = []
            continents = ["All"]
            continentMap = [:]
            worldTiles = []
            return
        }

        meals = payload.meals
        worlds = payload.V17_WORLDS
        freeFeatured = payload.WORLD_FREE_FEATURED
        continents = payload.WORLD_CONTINENTS
        continentMap = payload.WORLD_CONTINENT_MAP

        var bars: [String: [NutrientBar]] = [:]
        for (meal, rows) in payload.V17_NUTRIENTS {
            bars[meal] = rows.compactMap { row in
                guard row.count >= 2 else { return nil }
                return NutrientBar(name: row[0].stringValue, percent: row[1].intValue)
            }
        }
        nutrients = bars

        countries = payload.WORLD_COUNTRIES.compactMap { row in
            guard row.count >= 4 else { return nil }
            return Country(
                name: row[0].stringValue,
                region: row[1].stringValue,
                areas: row[2].listValue,
                foods: row[3].listValue
            )
        }

        worldTiles = payload.worlds.compactMap { row in
            guard row.count >= 3 else { return nil }
            return WorldTile(title: row[0], subtitle: row[1], img: row[2])
        }
    }

    // MARK: - Lookups mirroring the prototype's helpers

    func index(ofMealNamed name: String) -> Int? {
        meals.firstIndex { $0.name == name }
    }

    func country(named name: String) -> Country? {
        countries.first { $0.name == name }
    }

    /// `worldContinent(country)`
    func continent(for country: String) -> String {
        for key in continentMap.keys.sorted() where continentMap[key]?.contains(country) == true {
            return key
        }
        return "Asia"
    }

    /// `V17_NUTRIENTS[m.name] || [['Protein',30],['Fibre',25],['Iron',20],['Vitamin C',25]]`
    func nutrientBars(for meal: Meal) -> [NutrientBar] {
        nutrients[meal.name] ?? [
            NutrientBar(name: "Protein", percent: 30),
            NutrientBar(name: "Fibre", percent: 25),
            NutrientBar(name: "Iron", percent: 20),
            NutrientBar(name: "Vitamin C", percent: 25)
        ]
    }

    /// `nutrientMeaning(n)`
    static func nutrientMeaning(_ n: String) -> String {
        let x = n.lowercased()
        if x.contains("protein") { return "helps maintain and repair body tissues" }
        if x.contains("fibre") { return "supports normal digestive function" }
        if x.contains("calcium") { return "contributes to normal bones and teeth" }
        if x.contains("iron") { return "contributes to normal oxygen transport" }
        if x.contains("folate") { return "contributes to normal blood formation" }
        if x.contains("vitamin c") { return "contributes to normal immune function" }
        if x.contains("vitamin d") { return "contributes to normal muscle and bone function" }
        if x.contains("b12") { return "contributes to normal red blood cell formation" }
        if x.contains("potassium") { return "contributes to normal muscle function" }
        if x.contains("magnesium") { return "contributes to normal energy metabolism" }
        if x.contains("omega 3") { return "provides a source of long chain omega 3 fats" }
        return "one part of a varied diet"
    }

    /// `chefCue(m, n)`
    static func chefCue(step: Int) -> String {
        let cues = [
            "Get everything ready before you start. A little preparation makes the cooking feel easier.",
            "Listen and look: gentle bubbling is usually enough here. Avoid rushing the heat.",
            "Taste if appropriate and adjust seasoning gradually. You can always add more, but you cannot take it away.",
            "Give the finished food a minute to settle before serving."
        ]
        return cues[min(step, cues.count - 1)]
    }

    /// The named dishes behind `openCulture(place)`.
    static let cultureNames: [String: [String]] = [
        "Nepal": ["Nepali dal bhat tarkari"],
        "Ghana": ["Ghanaian grilled tilapia & fries", "Ghanaian jollof rice with beans"],
        "Sweden": ["Swedish köttbullar with lingonberry"],
        "Japan": ["True ramen · shoyu style", "Japanese salmon rice bowl"],
        "Vietnam": ["Vietnamese chicken phở"],
        "Korea": ["Korean bibimbap"],
        "Fiji": ["Fijian kokoda"],
        "India": ["Masala dosa with sambar"],
        "Peru": ["Peruvian ceviche"],
        "Amazon": ["Amazonian tacacá"],
        "Hawaiʻi": ["Hawaiian poke bowl"],
        "Mediterranean": ["Shakshuka with wholegrain bread"],
        "Morocco": ["Moroccan chickpea vegetable tagine"],
        "Middle East": ["Middle Eastern lentil soup with wholegrain flatbread"],
        "Ethiopia": ["Ethiopian lentil stew with greens"],
        "Latin America": ["Mexican black bean, corn & avocado bowl"]
    ]

    /// `culturePicks` on the Today screen.
    struct CulturePick: Identifiable, Hashable {
        var place: String
        var meal: String
        var id: String { place }
    }

    static let culturePicks: [CulturePick] = [
        CulturePick(place: "Ghana", meal: "Ghanaian grilled tilapia & fries"),
        CulturePick(place: "Sweden", meal: "Swedish köttbullar with lingonberry"),
        CulturePick(place: "Japan", meal: "True ramen · shoyu style"),
        CulturePick(place: "Vietnam", meal: "Vietnamese chicken phở"),
        CulturePick(place: "Korea", meal: "Korean bibimbap"),
        CulturePick(place: "Fiji", meal: "Fijian kokoda"),
        CulturePick(place: "India", meal: "Masala dosa with sambar"),
        CulturePick(place: "Peru", meal: "Peruvian ceviche"),
        CulturePick(place: "Amazon", meal: "Amazonian tacacá"),
        CulturePick(place: "Hawaiʻi", meal: "Hawaiian poke bowl")
    ]

    /// `commonsFoodImageUrl(food, country)` — the verified Commons images used
    /// for the country sheets.
    static let commonsFoodImages: [String: String] = [
        "ghana|grilled tilapia & yam chips": "https://commons.wikimedia.org/wiki/Special:FilePath/Grilled_Tilapia_Ghana.JPG?width=900",
        "ghana|jollof rice": "https://commons.wikimedia.org/wiki/Special:FilePath/Jollof%20Rice%20in%20Ghana.jpg?width=900",
        "nepal|dal bhat tarkari": "https://commons.wikimedia.org/wiki/Special:FilePath/Dal_bhat.jpg?width=900",
        "japan|ramen": "https://commons.wikimedia.org/wiki/Special:FilePath/Ramen.jpg?width=900",
        "vietnam|pho": "https://commons.wikimedia.org/wiki/Special:FilePath/Vietnamese%20Pho.jpg?width=900",
        "korea|bibimbap": "https://commons.wikimedia.org/wiki/Special:FilePath/Korean%20Bibimbap.jpg?width=900",
        "fiji|kokoda": "https://commons.wikimedia.org/wiki/Special:FilePath/Kokodafood.jpg?width=900",
        "india|masala dosa": "https://commons.wikimedia.org/wiki/Special:FilePath/Dosa%20India.jpg?width=900",
        "peru|ceviche": "https://commons.wikimedia.org/wiki/Special:FilePath/Ceviche%20de%20pescado.jpg?width=900",
        "amazon|tacacá": "https://commons.wikimedia.org/wiki/Special:FilePath/Tacac%C3%A1%20(Brazilian%20indigenous%20soup)%20(51404038372).jpg?width=900",
        "hawaiʻi|poke bowl": "https://commons.wikimedia.org/wiki/Special:FilePath/Limupoke.jpg?width=900"
    ]

    static func commonsFoodImage(food: String, country: String) -> String? {
        commonsFoodImages["\(country)|\(food)".lowercased()]
    }

    // Photography used outside the meal library, kept at the same URLs.
    static let peopleImage = "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85"
    static let moveImage = "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=85"
    static let discoveryImage = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85"
    static let morningFeatureImage = "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=88"
    static let nepalMorningImage = "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=88"
    static let onboardingHeroImage = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=90"
    static let authHeroImage = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=90"
}
