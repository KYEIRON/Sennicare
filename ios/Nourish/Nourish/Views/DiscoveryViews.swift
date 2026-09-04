import SwiftUI

/// `openMorningDiscovery()`
struct MorningDiscoveryView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            RemoteImage(NourishData.nepalMorningImage, height: 240, cornerRadius: 20)
            Eyebrow("Nepal").padding(.top, 4)
            H2("A morning in Nepal")
            Para("Food is shaped by place, climate, tradition and what people grow and cook every day.")
            VStack(alignment: .leading, spacing: 8) {
                H3("Dal bhat")
                Para("A familiar combination of lentils, rice and vegetables. A simple example of how a few everyday ingredients can become a complete meal.")
                PrimaryButton(title: "Discover a meal") {
                    if let index = store.data.index(ofMealNamed: "Nepali dal bhat tarkari") {
                        router.present(.meal(index))
                    }
                }
            }
            .cardStyle()
            NoticeBox("Nourish uses food and culture as a way to help you discover new possibilities, without telling you what you must eat.")
        }
    }
}

/// `openCulture(place)`
struct CultureView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    var place: String

    private var info: WorldInfo? {
        store.data.worlds[place] ?? store.data.worlds["Nepal"]
    }

    private var related: [MealRef] {
        let names = NourishData.cultureNames[place] ?? []
        let matched = store.mealRefs.filter { names.contains($0.meal.name) }
        if !matched.isEmpty { return matched }
        return Array(store.mealRefs.prefix(2))
    }

    var body: some View {
        SheetScaffold {
            if let info {
                RemoteImage(info.img, height: 230, cornerRadius: 20)
                Eyebrow(info.tag).padding(.top, 4)
                H2(place)
                Para(info.description)
                VStack(alignment: .leading, spacing: 10) {
                    H3("Try it in your kitchen")
                    Para("Start with a dish from this food culture, then follow the ingredients and chef style steps.")
                    ForEach(related) { ref in
                        FoodBigCard(meal: ref.meal) { router.present(.meal(ref.index)) }
                    }
                }
                .cardStyle()
                SourceNote("Demo image source: Wikimedia Commons. Production will keep image licence, author and attribution metadata with each asset.")
            }
        }
    }
}

/// `openCountry(name)` — including the Commons image hydration.
struct CountryView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    var name: String

    private var country: Country? { store.data.country(named: name) }

    /// The prototype's featured hero: a meal from this culture, else a meal
    /// whose name matches the country's first dish.
    private var featured: Meal? {
        if let match = store.meals.first(where: { $0.culture == name }) { return match }
        guard let first = country?.foods.first?.lowercased().split(separator: " ").first else { return nil }
        return store.meals.first { $0.name.lowercased().contains(first) }
    }

    var body: some View {
        SheetScaffold {
            if let country {
                if let image = featured?.img {
                    RemoteImage(image, height: 210, cornerRadius: 20)
                } else {
                    Text("Explore \(country.region)")
                        .font(Serif.font(21))
                        .foregroundColor(Theme.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 210)
                        .background(
                            LinearGradient(colors: [Color(hex: 0xE8EDE4), Theme.sand],
                                           startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }

                Eyebrow(country.region).padding(.top, 4)
                H2(country.name)
                Para("Explore regional foodways through dishes, ingredients and stories. No single dish represents an entire country.")

                ForEach(country.foods.indices, id: \.self) { i in
                    CountryFoodCard(
                        food: country.foods[i],
                        area: country.areas.isEmpty ? "" : country.areas[i % country.areas.count],
                        country: country.name
                    )
                }

                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow("Go deeper with Nourish+")
                    H3("More dishes. More regions. More ways to cook.")
                    Para("Plus opens the full country library, richer regional stories, more recipes and more image led discovery. Free members can explore the featured set and see what is waiting beyond it.")
                    PrimaryButton(title: "Explore Nourish+") { router.present(.plus) }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.line, lineWidth: 1))

                NoticeBox(
                    title: "Editorial principle:",
                    "every food image and cultural description should be sourced, rights checked and reviewed for accuracy before publication."
                )

                SecondaryButton(title: "Keep exploring food") { router.closeAndShow(.food) }
            }
        }
    }
}

/// `.foodImageCard` — one dish, with its Wikimedia Commons image and source line.
struct CountryFoodCard: View {
    var food: String
    var area: String
    var country: String

    @State private var image: CommonsImage?
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RemoteImage(image?.url, height: 150)
            VStack(alignment: .leading, spacing: 5) {
                Text(area)
                    .font(.system(size: 9, weight: .heavy))
                    .kerning(1)
                    .textCase(.uppercase)
                    .foregroundColor(Theme.muted)
                Text(food).font(.system(size: 14, weight: .bold)).foregroundColor(Theme.ink)
                Para("A foodway to explore from this region. The image should match the exact dish, not merely the country.", size: 11)
                if let image {
                    Text(image.sourceLine)
                        .font(.system(size: 9))
                        .foregroundColor(Theme.muted)
                } else if failed {
                    Text("No verified image found yet. Keep this dish out of the production library until sourced.")
                        .font(.system(size: 9))
                        .foregroundColor(Theme.muted)
                }
            }
            .padding(13)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        .task {
            if let known = NourishData.commonsFoodImage(food: food, country: country) {
                image = CommonsImage(url: known, author: "", license: "Verify individual file licence", source: "Wikimedia Commons")
                return
            }
            if let found = await CommonsSearch.find(food: food, country: country) {
                image = found
            } else {
                failed = true
            }
        }
    }
}

/// A picture found on Wikimedia Commons, with the attribution the prototype keeps.
struct CommonsImage: Codable, Equatable {
    var url: String
    var author: String
    var license: String
    var source: String

    var sourceLine: String {
        var line = "Source: \(source.isEmpty ? "Wikimedia Commons" : source)"
        if !author.isEmpty { line += " · \(author)" }
        if !license.isEmpty { line += " · \(license)" }
        return line
    }
}

/// `findCommonsFoodImage(food, country)` — the same Commons API query and the
/// same local cache the prototype uses.
enum CommonsSearch {
    static func find(food: String, country: String) async -> CommonsImage? {
        let key = "nourishFoodImg:\(country)|\(food)"
        if let raw = UserDefaults.standard.data(forKey: key),
           let cached = try? JSONDecoder().decode(CommonsImage.self, from: raw) {
            return cached
        }

        let search = "File:\(food) \(country)"
        var components = URLComponents(string: "https://commons.wikimedia.org/w/api.php")
        components?.queryItems = [
            URLQueryItem(name: "action", value: "query"),
            URLQueryItem(name: "generator", value: "search"),
            URLQueryItem(name: "gsrsearch", value: search),
            URLQueryItem(name: "gsrnamespace", value: "6"),
            URLQueryItem(name: "gsrlimit", value: "5"),
            URLQueryItem(name: "prop", value: "imageinfo"),
            URLQueryItem(name: "iiprop", value: "url|extmetadata"),
            URLQueryItem(name: "iiurlwidth", value: "900"),
            URLQueryItem(name: "format", value: "json")
        ]
        guard let url = components?.url else { return nil }

        var request = URLRequest(url: url)
        request.setValue("Nourish/1.0 (iOS prototype)", forHTTPHeaderField: "User-Agent")

        guard
            let (data, _) = try? await URLSession.shared.data(for: request),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let query = json["query"] as? [String: Any],
            let pages = query["pages"] as? [String: Any]
        else { return nil }

        for (_, value) in pages {
            guard
                let page = value as? [String: Any],
                let infos = page["imageinfo"] as? [[String: Any]],
                let info = infos.first
            else { continue }
            let link = (info["thumburl"] as? String) ?? (info["url"] as? String) ?? ""
            guard !link.isEmpty else { continue }
            let meta = info["extmetadata"] as? [String: Any] ?? [:]
            let image = CommonsImage(
                url: link,
                author: strip(meta, "Artist"),
                license: strip(meta, "LicenseShortName"),
                source: "Wikimedia Commons"
            )
            if let raw = try? JSONEncoder().encode(image) {
                UserDefaults.standard.set(raw, forKey: key)
            }
            return image
        }
        return nil
    }

    private static func strip(_ meta: [String: Any], _ key: String) -> String {
        guard
            let entry = meta[key] as? [String: Any],
            let value = entry["value"] as? String
        else { return "" }
        return value.replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression)
    }
}

/// `openIngredientDiscovery()`
struct IngredientDiscoveryView: View {
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            Eyebrow("Ingredient curiosity")
            H2("What else can a courgette do?")
            Para("Roast it, fold it through grains, add it to a tray bake or turn it into a simple soup. Nourish can use one ingredient as a starting point for discovery rather than a restriction.")
            VStack(alignment: .leading, spacing: 8) {
                H3("Try it tonight")
                Para("Courgette, chickpea and herb bowl · 20 minutes")
                PrimaryButton(title: "See a meal") { router.present(.meal(4)) }
            }
            .cardStyle()
        }
    }
}
