import SwiftUI

/// The Food tab — `food()` in the prototype.
struct FoodView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    private let moods = [
        "Easy tonight", "Something plant based", "Fish", "Chicken", "Meat",
        "Something light", "Comforting", "High protein", "High fibre",
        "Use what I have", "Under 30 minutes", "Something new"
    ]

    var body: some View {
        PageScroll {
            intro
            SmartKitchenBlock(text: "Tell Nourish what you already have. It can find meals that use it first and show you what is missing.")
                .padding(.top, 16)
            moodSection
            selectedForYou
            fromSomewhereNew
            nutrientsCard
            WorldAtlasSection()
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Food")
            H1("Find something you'll want to make.")
            Para("Explore meals, ingredients, nutrients and food from around the world.")
            Text("⌕  Search meals, ingredients or nutrients")
                .font(.system(size: 13))
                .foregroundColor(Theme.muted)
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xEEECE6))
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .padding(.top, 12)
    }

    private var moodSection: some View {
        Block {
            SectionLabel("What might work today?")
            FlowLayout(spacing: 8) {
                ForEach(moods, id: \.self) { mood in
                    FitChip(title: mood) { router.filterFood(mood) }
                }
            }
        }
    }

    private var selectedForYou: some View {
        Block {
            SectionLabel("Selected for you")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(store.mealRefs) { ref in
                    FoodBigCard(meal: ref.meal) { router.present(.meal(ref.index)) }
                }
            }
        }
    }

    private var fromSomewhereNew: some View {
        Block {
            SectionLabel("From somewhere new")
            H2("Food worth discovering")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(store.data.worldTiles) { tile in
                        WorldCardView(tile: tile) {
                            router.present(.culture(FoodView.culturePlace(for: tile.title)))
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    /// The prototype maps a few rail titles onto culture keys.
    static func culturePlace(for title: String) -> String {
        switch title {
        case "West Africa": return "Ghana"
        case "South Asia": return "Nepal"
        case "East Asia": return "Japan"
        case "North Africa": return "Morocco"
        case "Scandinavia": return "Sweden"
        default: return title
        }
    }

    private var nutrientsCard: some View {
        Block {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Nutrients")
                H3("See what your food brings.")
                Para("Explore protein, fibre, iron, folate, calcium and other nutrients that contribute to a varied diet.")
            }
            .cardStyle()
        }
    }
}

/// `filterFood(term)` — the results page pushed from a chip.
struct FilterFoodView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    var term: String

    private var isKidney: Bool { term.lowercased() == "kidney aware" }

    private var matched: [MealRef] {
        let q = term.lowercased()
        return store.mealRefs.filter { ref in
            let meal = ref.meal
            let text = "\(meal.name) \(meal.meta) \(meal.fit ?? "") \(meal.ingredients.joined(separator: " ")) \((meal.fits ?? []).joined(separator: " "))".lowercased()
            return text.contains(q)
                || (q == "under 30 minutes" && meal.duration <= 30)
                || (q == "high fibre" && text.contains("fibre"))
        }
    }

    var body: some View {
        PageScroll {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("Food · \(term)")
                H1(isKidney ? "Kidney aware food" : "Ideas that fit.")
                Para(isKidney
                     ? "Kidney diets vary by condition, stage, blood tests and treatment. This demo does not label recipes as kidney friendly without clinical review."
                     : "Explore the food itself first. Fit labels help you narrow the field without putting food into good or bad boxes.")

                if isKidney {
                    NoticeBox(
                        title: "How Nourish should handle this",
                        "In production, kidney related labels will use verified sodium, potassium, phosphorus, protein and portion data, with appropriate clinical review. The app should never imply that one meal is universally safe for everyone with kidney disease."
                    )
                } else if matched.isEmpty {
                    Para("No exact matches in this demo yet.")
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(matched) { ref in
                            FoodBigCard(meal: ref.meal) { router.present(.meal(ref.index)) }
                        }
                    }
                    .padding(.top, 4)
                }

                NoticeBox(
                    title: "Health fit note",
                    "Vegan labels can often be recipe based. Keto and kidney related suitability is more individual and should only be shown from verified nutrition data and appropriate professional guidance."
                )
                .padding(.top, 6)
            }
            .padding(.top, 12)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
    }
}

/// `worldAtlasSection()` plus `renderAtlas()`.
struct WorldAtlasSection: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    @State private var query = ""
    @State private var continent = "All"

    /// `atlasVisibleCountries()`
    private var visible: [Country] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        var list = store.data.countries.filter { country in
            q.isEmpty
                || country.name.lowercased().contains(q)
                || country.region.lowercased().contains(q)
                || country.foods.contains { $0.lowercased().contains(q) }
        }
        if continent != "All" {
            list = list.filter { store.data.continent(for: $0.name) == continent }
        }
        return list
    }

    /// Free members see the featured twelve plus four locked previews.
    private var shown: [Country] {
        if store.plus { return visible }
        let featured = visible.filter { store.data.freeFeatured.contains($0.name) }.prefix(12)
        let locked = visible.filter { !store.data.freeFeatured.contains($0.name) }.prefix(4)
        return Array(featured) + Array(locked)
    }

    private var limit: Int { store.plus ? store.data.countries.count : 12 }

    var body: some View {
        Block {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("The world of food")
                H2("195 countries. Endless foodways.")
                Para("From neighbourhood kitchens to regional traditions, there is always another table to discover.")
                Text(countLabel)
                    .font(.system(size: 10))
                    .foregroundColor(Theme.muted)
            }

            controls

            LazyVStack(spacing: 10) {
                ForEach(shown) { country in
                    AtlasCard(country: country, locked: locked(country)) {
                        open(country)
                    }
                }
            }

            if visible.count > limit {
                atlasPreview
            }

            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("Image led discovery")
                H3("Every dish should make you curious.")
                Para("Free members get a curated taste of the world. Nourish+ opens the deeper image rich library, with more regional dishes, recipes and variations.")
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .padding(.top, 14)

            VStack(alignment: .leading, spacing: 6) {
                Text("Curiosity is free. Depth is Plus.")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.ink)
                Para("Free members can taste the discovery experience. Nourish+ opens the full atlas, deeper regional exploration and more variations.", size: 11)
            }
            .surfaceStyle(Theme.warmSurface, padding: 16, radius: 20)
        }
        .padding(.top, 18)
    }

    private var countLabel: String {
        store.plus
            ? "\(visible.count) countries available"
            : "12 featured countries free · locked previews shown below · \(store.data.countries.count) in the full atlas"
    }

    private var controls: some View {
        VStack(spacing: 8) {
            TextField("Search a country or food", text: $query)
                .font(.system(size: 13))
                .autocorrectionDisabled()
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))

            Menu {
                ForEach(store.data.continents, id: \.self) { option in
                    Button(option) { continent = option }
                }
            } label: {
                HStack {
                    Text(continent).font(.system(size: 13)).foregroundColor(Theme.ink)
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 11)).foregroundColor(Theme.muted)
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))
            }
        }
        .padding(.vertical, 4)
    }

    private var atlasPreview: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !store.plus {
                Text("There is much more to discover.")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.ink)
            }
            Text(store.plus
                 ? "\(visible.count) countries shown."
                 : "Explore 12 featured countries free. Nourish+ unlocks the full world atlas, regional foodways and deeper stories.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
                .lineSpacing(3)
            if !store.plus {
                PrimaryButton(title: "Unlock the world") { router.present(.plus) }
            }
        }
        .surfaceStyle(Theme.warmSurface, padding: 16, radius: 20)
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .padding(.top, 12)
    }

    private func locked(_ country: Country) -> Bool {
        !store.plus && !store.data.freeFeatured.contains(country.name)
    }

    /// `openCountry(name)`
    private func open(_ country: Country) {
        if locked(country) {
            router.present(.plus)
        } else {
            router.present(.country(country.name))
        }
    }
}

/// `.atlasCard`
struct AtlasCard: View {
    @EnvironmentObject var store: AppStore
    var country: Country
    var locked: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(String(country.name.prefix(2)).uppercased())
                        .font(Serif.font(13))
                        .foregroundColor(Color(hex: 0x485345))
                        .frame(width: 34, height: 34)
                        .background(Theme.sage2)
                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    Spacer()
                    if locked {
                        PremiumTag()
                    } else {
                        Text(store.data.continent(for: country.name))
                            .font(.system(size: 10))
                            .foregroundColor(Theme.muted)
                    }
                }
                Text(country.name).font(Serif.font(21)).foregroundColor(Theme.ink)
                Text(country.areas.joined(separator: " · "))
                    .font(.system(size: 10))
                    .foregroundColor(Theme.muted)
                    .multilineTextAlignment(.leading)
                FlowLayout(spacing: 5) {
                    ForEach(country.foods, id: \.self) { food in
                        Text(food)
                            .font(.system(size: 9))
                            .foregroundColor(Color(hex: 0x5E5B55))
                            .padding(.vertical, 5)
                            .padding(.horizontal, 7)
                            .background(Theme.warmSurfaceAlt)
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
            .opacity(locked ? 0.72 : 1)
        }
        .buttonStyle(.plain)
    }
}
