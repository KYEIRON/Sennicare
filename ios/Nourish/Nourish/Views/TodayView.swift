import SwiftUI

/// The Today tab — `today()` in the prototype.
struct TodayView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    @State private var offset = 0

    private let fits = [
        "Spicy", "Vegan friendly", "Keto friendly",
        "Kidney aware", "High fibre", "Under 30 minutes"
    ]

    var body: some View {
        PageScroll {
            intro
            morningFeature
            cultureHero
            fitSection
            slotSections
            atlasCard
            tokensCard
        }
        .onAppear { offset = store.dailyOffset() }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(greeting)
            H1("A world of food is waiting.")
            Para("Every day, discover dishes, ingredients and food traditions from somewhere you may not have explored before.")
        }
        .padding(.top, 12)
    }

    /// `.morningFeature`
    private var morningFeature: some View {
        Button {
            router.present(.morningDiscovery)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(NourishData.morningFeatureImage, height: 230)
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow("A new day")
                    H2("Food, health and culture bring us together.")
                    Para("From Ghanaian grilled tilapia to Japanese ramen, Vietnamese phở and Fijian kokoda. Your next favourite could come from anywhere.", size: 13)
                }
                .padding(.horizontal, 18)
                .padding(.top, 17)
                .padding(.bottom, 18)
            }
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .padding(.top, 20)
    }

    /// `.cultureHero`
    private var cultureHero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("Worth discovering")
            H2("Travel the world through food.")
            Para("Not a fixed menu. A living stream of curiosity, with new places, dishes and stories every day.")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(NourishData.culturePicks) { pick in
                        CultureCard(
                            place: pick.place,
                            caption: caption(for: pick.meal),
                            image: image(for: pick)
                        ) {
                            router.present(.culture(pick.place))
                        }
                    }
                }
                .padding(.vertical, 4)
            }

            Text("And this is only the beginning. West Africa, South Asia, East Asia, the Pacific, the Andes, the Amazon and beyond.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
                .lineSpacing(3)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.warmSurfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .padding(.top, 16)
    }

    private func caption(for meal: String) -> String {
        meal == "True ramen · shoyu style" ? "Ramen: Chinese roots, Japanese craft" : meal
    }

    private func image(for pick: NourishData.CulturePick) -> String? {
        if let index = store.data.index(ofMealNamed: pick.meal) {
            return store.meals[index].img
        }
        return store.data.worlds[pick.place]?.img
    }

    /// "How would you like it to fit?"
    private var fitSection: some View {
        Block {
            SectionLabel("How would you like it to fit?")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(fits, id: \.self) { fit in
                        FitChip(title: fit) { router.filterFood(fit) }
                    }
                }
                .padding(.vertical, 2)
            }
            Text("Food fit is recipe specific. Health related labels need verified nutrition data and, for medical diets, individual professional guidance.")
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)
                .lineSpacing(3)
        }
    }

    private var slotSections: some View {
        ForEach(["Breakfast", "Lunch", "Dinner"], id: \.self) { slot in
            slotSection(slot)
        }
    }

    private func slotSection(_ slot: String) -> some View {
        let selected = store.todaysMeals(slot: slot, offset: offset)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom) {
                Text(slot).font(Serif.font(27)).foregroundColor(Theme.ink)
                Spacer()
                Text(store.plus ? "\(selected.count) ways to explore" : "4 ideas today")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(selected) { entry in
                        MealCardV10(meal: entry.meal, index: entry.index) {
                            router.present(.meal(entry.index))
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            if !store.plus {
                Button {
                    router.present(.plus)
                } label: {
                    Text("See more variations with Nourish+")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Theme.sage)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 30)
    }

    private var atlasCard: some View {
        Block {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("World food atlas")
                H2("Where will food take you next?")
                Para("Every country has many foodways, shaped by regions, seasons, migration and family traditions.")
                HStack(alignment: .center, spacing: 10) {
                    Text(store.plus ? "195 countries unlocked" : "Taste 12 today · 195 in the full atlas")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.muted)
                    Spacer(minLength: 6)
                    SecondaryButton(title: "Explore the atlas", fullWidth: false) {
                        router.show(.food)
                    }
                }
            }
            .cardStyle()
        }
    }

    private var tokensCard: some View {
        RewardCard(
            eyebrow: "Keep exploring",
            title: "\(store.tokens) Nourish tokens",
            token: "Cook · learn · discover",
            text: "Tomorrow brings a new set of ideas. The world of food never runs out of stories.",
            button: nil
        )
        .padding(.top, 14)
    }
}
