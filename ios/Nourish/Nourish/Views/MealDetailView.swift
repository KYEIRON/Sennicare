import SwiftUI

/// `openMeal(i)` — the full meal sheet.
struct MealDetailView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    var index: Int

    private var meal: Meal? {
        store.meals.indices.contains(index) ? store.meals[index] : nil
    }

    var body: some View {
        SheetScaffold {
            if let meal {
                content(meal)
            } else {
                H2("This meal is no longer available.")
            }
        }
        .onAppear { store.markExplored(index) }
    }

    @ViewBuilder
    private func content(_ meal: Meal) -> some View {
        header(meal)
        middle(meal)
        details(meal)
    }

    @ViewBuilder
    private func header(_ meal: Meal) -> some View {
        RemoteImage(meal.img, height: 280, cornerRadius: 20)
        Eyebrow(subtitle(meal)).padding(.top, 4)
        H2(meal.name)
        Para(meal.meta)
        MealTagRow(meal: meal)

        if meal.culture != nil {
            VStack(alignment: .leading, spacing: 4) {
                Text("Food & culture").font(.system(size: 11, weight: .bold)).foregroundColor(Theme.ink)
                Text("This dish is here as an invitation to explore its food tradition, not as a single definition of a country's cuisine.")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
                    .lineSpacing(3)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: 0xF7F4ED))
            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 17, style: .continuous).stroke(Theme.line, lineWidth: 1))
        }
    }

    @ViewBuilder
    private func middle(_ meal: Meal) -> some View {
        HStack(spacing: 9) {
            statBox("\(meal.cal)", "kcal")
            statBox("\(meal.duration)", "minutes")
            statBox("\(store.tokens)", "tokens")
        }
        .padding(.top, 4)

        if store.profile.priorities.contains("Digestive comfort"), let fit = meal.fit {
            VStack(alignment: .leading, spacing: 4) {
                Text("For your digestion priority")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(Theme.ink)
                Para("\(fit) Individual tolerance varies, so use your own experience as a guide.", size: 12)
            }
            .surfaceStyle(Theme.sage2.opacity(0.6), padding: 14, radius: 18)
        }

        nutritionCard(meal)

        RewardCard(
            eyebrow: "Learn as you go",
            title: "Know what is on your plate",
            token: "+2 tokens",
            text: "Explore the nutrient bars and the simple reason each nutrient matters. The aim is curiosity, not perfection.",
            button: ("I have explored this", { store.awardTokens(1, "nutrition explored") })
        )
    }

    @ViewBuilder
    private func details(_ meal: Meal) -> some View {
        ingredientsCard(meal)
        stepsCard(meal)
        NoticeBox("Nutrition information is a demo estimate. If you are managing an allergy or medical condition, check ingredients carefully and follow professional advice.")
    }

    private func subtitle(_ meal: Meal) -> String {
        var text = "\(meal.slot) · \(meal.duration) min"
        if let culture = meal.culture { text += " · \(culture)" }
        return text
    }

    private func statBox(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(Serif.font(21)).foregroundColor(Theme.ink)
            Text(label).font(.system(size: 10)).foregroundColor(Theme.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.warmSurfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
    }

    private func nutritionCard(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            H3("What your meal brings")
            Para("Estimated contribution to daily reference values for the listed nutrients. Values are illustrative in this prototype.", size: 11)
            VStack(alignment: .leading, spacing: 11) {
                ForEach(store.data.nutrientBars(for: meal), id: \.name) { bar in
                    NutritionBarRow(bar: bar)
                }
            }
            SecondaryButton(title: "Explore with AI beta") { router.present(.aiDecide) }
        }
        .cardStyle()
    }

    private func ingredientsCard(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            H3("What you'll need")
            VStack(alignment: .leading, spacing: 0) {
                ForEach(meal.ingredients, id: \.self) { item in
                    Text(item)
                        .font(.system(size: 13))
                        .foregroundColor(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 7)
                        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .bottom)
                }
            }
            HStack(spacing: 9) {
                SecondaryButton(title: "Add to list") { store.addShoppingForMeal(index) }
                PrimaryButton(title: "Add to my week") { router.present(.planDayPicker(index)) }
            }
            .padding(.top, 6)
        }
        .cardStyle()
    }

    private func stepsCard(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            H3("Chef style cooking")
            Para("No assumed cooking knowledge. We tell you what to do, what to look for and roughly how long each stage takes.", size: 11)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(meal.steps.indices, id: \.self) { number in
                    (Text("\(number + 1). ").font(.system(size: 13, weight: .bold))
                     + Text(meal.steps[number]).font(.system(size: 13)))
                        .foregroundColor(Theme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            PrimaryButton(title: "Start cooking") { router.present(.cooking(index)) }
                .padding(.top, 6)
        }
        .cardStyle()
    }
}

/// `.nutritionBar`
struct NutritionBarRow: View {
    var bar: NutrientBar

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 8) {
                Text(bar.name)
                    .font(.system(size: 11))
                    .foregroundColor(Theme.ink)
                    .frame(width: 75, alignment: .leading)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color(hex: 0xECE9E1))
                        Capsule()
                            .fill(Theme.sage)
                            .frame(width: geo.size.width * CGFloat(min(100, bar.percent)) / 100.0)
                    }
                }
                .frame(height: 7)
                Text("\(bar.percent)%")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
                    .frame(width: 40, alignment: .trailing)
            }
            Text(NourishData.nutrientMeaning(bar.name))
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)
                .padding(.leading, 83)
        }
    }
}
