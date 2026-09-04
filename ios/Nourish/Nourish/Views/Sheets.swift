import SwiftUI

/// Routes every overlay to its view — the equivalent of the prototype's
/// `openSheet(type)` switch.
struct SheetHost: View {
    var route: SheetRoute

    var body: some View {
        switch route {
        case .meal(let i): MealDetailView(index: i)
        case .cooking(let i): CookingView(index: i)
        case .culture(let place): CultureView(place: place)
        case .country(let name): CountryView(name: name)
        case .morningDiscovery: MorningDiscoveryView()
        case .ingredientDiscovery: IngredientDiscoveryView()

        case .pantry: PantrySheet()
        case .shopping: ShoppingSheet()
        case .smartKitchen: SmartKitchenSheet()
        case .plus: PlusSheet()
        case .planPreferences: PlanPreferencesSheet()
        case .profile: ProfileSheet()

        case .planDayPicker(let i): PlanDayPickerSheet(mealIndex: i)
        case .mealPickerForDay(let i): MealPickerSheet(dayIndex: i)
        case .swap(let day): SwapSheet(day: day)
        case .move(let day): MoveSheet(day: day)

        case .morning: MorningSheet()
        case .movement: MovementSheet()
        case .breathing: BreathingSheet()
        case .recovery: InfoSheet.recovery
        case .discovery: InfoSheet.discovery
        case .aiSleep: InfoSheet.aiSleep
        case .aiEnergy: InfoSheet.aiEnergy
        case .aiDecide: InfoSheet.aiDecide
        case .aiBeta: InfoSheet.aiBeta
        case .legal: LegalSheet()
        case .wellbeingFood: WellbeingFoodSheet()
        case .sleep: SleepSheet()
        case .cultureWellbeing: CultureWellbeingSheet()
        }
    }
}

// MARK: - Kitchen

/// `openSheet('pantry')`
struct PantrySheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @State private var entry = ""

    var body: some View {
        SheetScaffold {
            Eyebrow("Your kitchen")
            H2("Pantry")
            Para("Keep a simple picture of what you already have at home. Nourish uses this to reduce unnecessary shopping and find meals you can make now.")

            HStack(spacing: 8) {
                TextField("Add an item you have", text: $entry)
                    .font(.system(size: 14))
                    .padding(13)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))
                PrimaryButton(title: "Add", fullWidth: false) {
                    store.addPantryItem(entry)
                    entry = ""
                }
            }

            ScanBox(
                title: "Scan your kitchen",
                text: "Take a photo of your cupboard, fridge or recent shop."
            ) { store.demoScan(shoppingList: false) }

            VStack(alignment: .leading, spacing: 0) {
                if store.pantry.isEmpty {
                    Para("Your pantry is empty. Add a few things you already have.")
                } else {
                    ForEach(store.pantry.indices, id: \.self) { index in
                        ListRow(title: store.pantry[index], subtitle: "At home", checked: nil, toggle: nil) {
                            store.removePantryItem(at: index)
                        }
                    }
                }
            }
            .cardStyle()

            PrimaryButton(title: "What can I make with these?") { router.present(.smartKitchen) }

            Text("For the prototype, scans use a demo set of items. Production would use image recognition and user confirmation before updating the pantry.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
        }
    }
}

/// `openSheet('shopping')`
struct ShoppingSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @State private var entry = ""

    var body: some View {
        SheetScaffold {
            Eyebrow("Your kitchen")
            H2("Shopping list")
            Para("Everything you want to buy, including ingredients Nourish adds from your meal plan.")

            VStack(alignment: .leading, spacing: 8) {
                TextEditor(text: $entry)
                    .font(.system(size: 14))
                    .frame(height: 84)
                    .scrollContentBackground(.hidden)
                    .padding(9)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))
                PrimaryButton(title: "Add") {
                    store.addShoppingText(entry)
                    entry = ""
                }
            }

            ScanBox(
                title: "Bring in your shop",
                text: "Photograph a receipt or import a list."
            ) { store.demoScan(shoppingList: true) }

            VStack(alignment: .leading, spacing: 0) {
                if store.shopping.isEmpty {
                    Para("Your list is empty. Add items or open a meal and add its ingredients.")
                } else {
                    ForEach(store.shopping.indices, id: \.self) { index in
                        let done = store.shoppingDone.contains(store.shopping[index])
                        ListRow(
                            title: store.shopping[index],
                            subtitle: done ? "Bought" : "To buy",
                            checked: done,
                            toggle: { store.toggleShoppingItem(at: index) }
                        ) {
                            store.removeShoppingItem(at: index)
                        }
                    }
                }
            }
            .cardStyle()

            SecondaryButton(title: "I already have some of these") { router.present(.pantry) }
        }
    }
}

/// `.listItem`
struct ListRow: View {
    var title: String
    var subtitle: String
    var checked: Bool?
    var toggle: (() -> Void)?
    var remove: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            if let checked {
                Button {
                    toggle?()
                } label: {
                    Text(checked ? "✓" : " ")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Theme.ink)
                        .frame(width: 26, height: 26)
                        .background(checked ? Theme.sage2 : Theme.warmSurface)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Theme.ink)
                    .strikethrough(checked == true)
                    .opacity(checked == true ? 0.55 : 1)
                Text(subtitle).font(.system(size: 10)).foregroundColor(Theme.muted)
            }
            Spacer(minLength: 6)
            Button(action: remove) {
                Text("Remove")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(Theme.muted)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 9)
                    .background(Theme.warmSurface)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 11)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .bottom)
    }
}

/// `.scanBox`
struct ScanBox: View {
    var title: String
    var text: String
    var action: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            Text(title).font(.system(size: 13, weight: .bold)).foregroundColor(Theme.ink)
            Text(text).font(.system(size: 11)).foregroundColor(Theme.muted)
            SecondaryButton(title: "Run a demo scan", fullWidth: false, action: action)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(17)
        .background(Color(hex: 0xF5F1E9))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Color(hex: 0xCFC9BC), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
    }
}

/// `renderSmartKitchen()`
struct SmartKitchenSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            Eyebrow("Smart kitchen")
            H2("What can I make?")
            Para("Start with what is already in your pantry. Nourish compares ingredients, your food preferences and the kind of meal you are exploring.")

            VStack(alignment: .leading, spacing: 4) {
                Text("Quiet intelligence").font(.system(size: 12, weight: .bold)).foregroundColor(Theme.ink)
                Para("These are suggestions, not instructions. You stay in control of what you cook, buy and eat.", size: 11)
            }
            .surfaceStyle(Theme.sage2.opacity(0.55), padding: 14, radius: 18)

            ForEach(store.smartMatches()) { match in
                VStack(alignment: .leading, spacing: 10) {
                    RemoteImage(match.meal.img, height: 150, cornerRadius: 18)
                    Text("\(Int((match.score * 100).rounded()))% from your pantry")
                        .font(.system(size: 10, weight: .heavy))
                        .kerning(1)
                        .textCase(.uppercase)
                        .foregroundColor(Theme.sage)
                    H3(match.meal.name)
                    Para("\(match.meal.cal) kcal · \(match.meal.meta)", size: 12)
                    Text(match.missing.isEmpty
                         ? "You have everything needed."
                         : "Need \(match.missing.count) more: \(match.missing.prefix(3).joined(separator: ", "))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(match.missing.isEmpty ? Theme.sage : Theme.accent)
                    HStack(spacing: 9) {
                        SecondaryButton(title: "See meal") { router.present(.meal(match.index)) }
                        PrimaryButton(title: "Add missing") { store.addShoppingForMeal(match.index) }
                    }
                }
                .cardStyle()
            }

            NoticeBox(
                title: "Nourish+ idea:",
                "camera and receipt scans, expiry aware suggestions, budget planning and automatic pantry updates can save time. Any production scan should show what was recognised and ask you to confirm before changing your kitchen."
            )
        }
    }
}

// MARK: - Plan sheets

/// `openPlanDayPicker(i)`
struct PlanDayPickerSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss
    var mealIndex: Int

    var body: some View {
        SheetScaffold {
            Eyebrow("Add to your plan")
            H2("Where should we put it?")
            Para(store.plus
                 ? "Your full week is open."
                 : "Free planning includes three days. You can still view all seven days.")

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
                ForEach(AppStore.days, id: \.self) { day in
                    let occupied = store.plannedMealIndex(day) != nil
                    let locked = store.dayIsLocked(day)
                    ChoiceTile(
                        title: day,
                        subtitle: occupied ? "Replace current meal" : (locked ? "Unlock with Plus" : "Choose this day"),
                        selected: false,
                        locked: locked
                    ) {
                        if locked {
                            router.present(.plus)
                        } else {
                            store.planMeal(mealIndex, on: day)
                            dismiss()
                        }
                    }
                }
            }

            if !store.plus && store.plannedDaysCount >= 3 {
                PlusGate(
                    title: "Want the whole week?",
                    text: "Upgrade to Nourish+ to plan all seven days and change meals freely.",
                    buttonTitle: "Explore Nourish+"
                ) { router.present(.plus) }
            }
        }
    }
}

/// `openMealPickerForDay(dayIndex)`
struct MealPickerSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss
    var dayIndex: Int

    private var day: String {
        AppStore.days.indices.contains(dayIndex) ? AppStore.days[dayIndex] : AppStore.days[0]
    }

    var body: some View {
        SheetScaffold {
            Eyebrow(day)
            H2("What would you like to cook?")
            Para("Choose a meal for this day. You can change it later.")

            let occupied = store.plannedMealIndex(day) != nil
            ForEach(Array(store.mealRefs.prefix(store.plus ? 10 : 5))) { ref in
                MealRow(
                    meal: ref.meal,
                    caption: "\(ref.meal.slot) · \(ref.meal.cal) kcal · \(ref.meal.duration) min",
                    buttonTitle: occupied ? "Use this" : "Add to \(day)"
                ) {
                    if store.planMeal(ref.index, on: day) {
                        dismiss()
                    } else {
                        router.present(.plus)
                    }
                }
            }

            if !store.plus {
                PlusGate(
                    title: "More meal choices with Nourish+",
                    text: "Free includes a smaller set. Plus opens a deeper pool of meals for every planning day.",
                    buttonTitle: "Explore Nourish+"
                ) { router.present(.plus) }
            }
        }
    }
}

/// `openSwap(day)`
struct SwapSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss
    var day: String

    var body: some View {
        SheetScaffold {
            Eyebrow("Change \(day)")
            H2("Choose a different meal.")
            Para("Keep the day, change the idea. Your plan updates immediately.")

            let current = store.plannedMealIndex(day)
            let alternatives = Array(
                store.mealRefs
                    .filter { $0.index != current }
                    .prefix(store.plus ? 8 : 4)
            )

            ForEach(alternatives) { ref in
                MealRow(
                    meal: ref.meal,
                    caption: "\(ref.meal.cal) kcal · \(ref.meal.duration) min",
                    buttonTitle: "Use this"
                ) {
                    if store.planMeal(ref.index, on: day) {
                        dismiss()
                    } else {
                        router.present(.plus)
                    }
                }
            }

            if !store.plus {
                PlusGate(
                    title: "More variations with Nourish+",
                    text: "Free gives you a smaller set of alternatives. Plus opens a deeper pool.",
                    buttonTitle: "See Nourish+"
                ) { router.present(.plus) }
            }
        }
    }
}

/// `openMove(day)`
struct MoveSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss
    var day: String

    var body: some View {
        SheetScaffold {
            Eyebrow("Move \(day)")
            H2("Choose another day.")
            Para("Keep the meal, change where it sits in your week.")

            let choices = AppStore.days.filter { $0 != day && store.plannedMealIndex($0) == nil }
            if choices.isEmpty {
                Para("No open days yet. Remove a meal or use Nourish+ for the full week.")
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
                    ForEach(choices, id: \.self) { target in
                        ChoiceTile(title: target, subtitle: "Move meal here", selected: false) {
                            store.movePlanMeal(from: day, to: target)
                            dismiss()
                        }
                    }
                }
            }

            if !store.plus && store.plannedDaysCount >= 3 {
                PlusGate(
                    title: "Need another planning day?",
                    text: "Nourish+ opens all seven days.",
                    buttonTitle: "Explore Nourish+"
                ) { router.present(.plus) }
            }
        }
    }
}

/// `openSheet('plan')`
struct PlanPreferencesSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var time: String?
    @State private var people: String?
    @State private var budget: String?

    var body: some View {
        SheetScaffold {
            Eyebrow("Build your week")
            H2("Make eating easier.")
            Para("Tell Nourish about your real life.")

            H3("Cooking time")
            grid(["10–15 minutes", "20–30 minutes", "I enjoy cooking", "Batch cooking"], selection: $time)

            H3("Planning for")
            grid(["Just me", "Two people", "Family", "Flexible"], selection: $people)

            H3("Budget")
            grid(["Value", "Balanced", "No preference"], selection: $budget)

            PrimaryButton(title: "Create my week") {
                dismiss()
                store.toast("Your week has been shaped around your choices.")
            }
        }
    }

    private func grid(_ options: [String], selection: Binding<String?>) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
            ForEach(options, id: \.self) { option in
                ChoiceTile(title: option, subtitle: nil, selected: selection.wrappedValue == option) {
                    selection.wrappedValue = option
                }
            }
        }
    }
}

// MARK: - Profile and Plus

/// `openSheet('profile')`
struct ProfileSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetScaffold {
            intro
            birthday
            preferences
            PrimaryButton(title: "Save preferences") {
                store.saveProfile()
                store.toast("Preferences saved.")
                dismiss()
                router.closeAndShow(.today)
            }
        }
    }

    @ViewBuilder
    private var intro: some View {
        Eyebrow("Your account")
        H2("Your preferences")
        Para("Keep Nourish relevant as your life changes.")
    }

    @ViewBuilder
    private var birthday: some View {
        H3("Date of birth")
        DateOfBirthPicker()

        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Birthday surprises").font(.system(size: 14, weight: .bold)).foregroundColor(Theme.ink)
                Para("A thoughtful idea around your birthday.", size: 11)
            }
            Toggle("", isOn: Binding(
                get: { store.profile.birthdaySurprises },
                set: { store.profile.birthdaySurprises = $0; store.saveProfile() }
            ))
            .labelsHidden()
            .tint(Theme.sage)
        }
        .padding(14)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    @ViewBuilder
    private var preferences: some View {
        H3("Gender")
        choices(["Woman", "Man", "Non binary", "Prefer not to say"]) {
            store.profile.gender == $0
        } action: {
            store.profile.gender = $0
            store.saveProfile()
        }

        H3("How you like to eat")
        Para("You can prefer mostly plant based food without giving up meat or fish.", size: 11)
        choices(["Mostly plant based", "Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "No preference"]) {
            store.profile.diet == $0
        } action: {
            store.profile.diet = $0
            store.saveProfile()
        }

        H3("Allergies")
        choices(["Peanuts", "Tree nuts", "Milk", "Eggs", "Fish", "Shellfish", "Wheat", "Soy", "None"]) { option in
            option == "None" ? store.profile.allergies.isEmpty : store.profile.allergies.contains(option)
        } action: { option in
            store.toggleAllergy(option)
        }
    }

    private func choices(
        _ options: [String],
        selected: @escaping (String) -> Bool,
        action: @escaping (String) -> Void
    ) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
            ForEach(options, id: \.self) { option in
                ChoiceTile(title: option, subtitle: nil, selected: selected(option)) { action(option) }
            }
        }
    }
}

/// `openSheet('plus')`
struct PlusSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss

    struct Feature: Identifiable {
        var title: String
        var text: String
        var id: String { title }
    }

    private let features: [Feature] = [
        Feature(title: "Smart pantry", text: "Tell Nourish what you have and find meals that use it first."),
        Feature(title: "Camera & receipt scans", text: "Turn a cupboard photo, fridge photo or shopping receipt into a pantry or shopping list."),
        Feature(title: "Ingredient rescue", text: "\u{201C}My spinach expires tomorrow. What can I make?\u{201D}"),
        Feature(title: "Smart shopping", text: "Combine your weekly meals, pantry and missing ingredients into one practical list."),
        Feature(title: "World food atlas", text: "Explore 195 countries, deeper regional foodways and a growing editorial library."),
        Feature(title: "More ways to choose", text: "See more meal variations at breakfast, lunch and dinner, with richer swaps and personalised alternatives."),
        Feature(title: "Budget & waste reduction", text: "Plan around what you own and buy only what is needed.")
    ]

    var body: some View {
        SheetScaffold {
            Eyebrow("Nourish+")
            H2("Your world becomes wider. Your kitchen becomes smarter.")
            Para("Nourish+ is designed to unlock depth and save real mental effort, not to make the free experience feel broken.")

            VStack(alignment: .leading, spacing: 12) {
                ForEach(features) { feature in
                    VStack(alignment: .leading, spacing: 4) {
                        H3(feature.title)
                        Para(feature.text, size: 12)
                    }
                }
            }
            .cardStyle()

            NoticeBox(
                title: "Free access:",
                "explore the world of food, keep a pantry and shopping list, and plan up to three days. Nourish+: unlock all 195 countries, deeper regional foodways, more meal variations, all seven planning days, flexible swaps, intelligent scans, pantry aware planning and deeper food intelligence."
            )

            PrimaryButton(title: "Start 14 day trial") {
                store.setPlus(true)
                dismiss()
                router.closeAndShow(.plan)
            }
            SecondaryButton(title: "Keep free version") {
                store.setPlus(false)
                dismiss()
                router.closeAndShow(.plan)
            }
            Text("$4.99/month or $39.99/year after trial.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
        }
    }
}

// MARK: - Wellbeing sheets

/// `openSheet('morning')`
struct MorningSheet: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            Eyebrow("Your morning")
            H2("Start gently")
            VStack(alignment: .leading, spacing: 6) {
                H3("01 · Hydrate")
                Para("Start with a glass of water if that suits you.")
            }
            .cardStyle()
            VStack(alignment: .leading, spacing: 8) {
                H3("02 · Breakfast")
                if let first = store.meals.first {
                    Para("\(first.name) · \(first.cal) kcal")
                }
                SecondaryButton(title: "See breakfast") { router.present(.meal(0)) }
            }
            .cardStyle()
            VStack(alignment: .leading, spacing: 6) {
                H3("03 · Move")
                Para("A few minutes of walking or stretching.")
            }
            .cardStyle()
        }
    }
}

/// `openSheet('move')`
struct MovementSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var choice: String?

    var body: some View {
        SheetScaffold {
            Eyebrow("Move")
            H2("A little movement goes a long way.")
            Para("Choose something that feels realistic today.")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible(), spacing: 9)], spacing: 9) {
                ForEach(["10 minute walk", "Gentle stretch", "Mobility", "Gentle strength"], id: \.self) { option in
                    ChoiceTile(title: option, subtitle: nil, selected: choice == option) { choice = option }
                }
            }
            PrimaryButton(title: "Done") { dismiss() }
        }
    }
}

/// `openSheet('breathing')` and `startBreath()`
struct BreathingSheet: View {
    @State private var phase = "Breathe"
    @State private var expanded = false
    @State private var count = 0
    @State private var running = false

    private let ticker = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

    var body: some View {
        SheetScaffold {
            Eyebrow("Reset")
            H2("Breathe with Nourish")
            Para("Follow the circle. Inhale as it grows. Exhale as it softens.")

            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Theme.sage2)
                        .frame(width: 150, height: 150)
                        .scaleEffect(expanded ? 1.15 : 0.9)
                        .animation(.easeInOut(duration: 4.6), value: expanded)
                    Text(phase)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: 0x4C5848))
                }
                Text("A calm 2 minute practice")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)

            PrimaryButton(title: "Begin") {
                count = 0
                phase = "Inhale"
                expanded = true
                running = true
            }
        }
        .onReceive(ticker) { _ in
            guard running else { return }
            count += 1
            if count >= 23 {
                running = false
                phase = "Well done"
                return
            }
            phase = count % 2 == 1 ? "Exhale" : "Inhale"
            expanded = phase == "Inhale"
        }
    }
}

/// `openSheet('wellbeingFood')`
struct WellbeingFoodSheet: View {
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            Eyebrow("Eat well")
            H2("Make wellbeing feel practical.")
            Para("Use food as part of your everyday rhythm. Explore meals you enjoy, learn what nutrients they bring and notice what leaves you feeling well.")
            VStack(alignment: .leading, spacing: 8) {
                Text("Try tonight").font(.system(size: 13, weight: .bold)).foregroundColor(Theme.ink)
                Para("Choose one meal from Food, then use Nutrition to understand what is in it.")
                SecondaryButton(title: "Explore food") { router.closeAndShow(.food) }
            }
            .cardStyle()
        }
    }
}

/// `openSheet('sleep')`
struct SleepSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetScaffold {
            Eyebrow("Sleep")
            H2("A gentler evening.")
            Para("There is no universal perfect dinner time. If eating late seems to affect your sleep, experiment with giving yourself some time between a larger meal and bed.")
            PrimaryButton(title: "Keep this idea") {
                dismiss()
                store.toast("Your evening idea is ready.")
            }
        }
    }
}

/// `openSheet('cultureWellbeing')`
struct CultureWellbeingSheet: View {
    @EnvironmentObject var router: Router

    var body: some View {
        SheetScaffold {
            Eyebrow("Food & culture")
            H2("Wellbeing has many traditions.")
            Para("From shared meals to tea rituals, fermented foods, slow cooking and family recipes, food culture carries ways of caring for ourselves and one another.")
            PrimaryButton(title: "Start with Ghana") { router.present(.culture("Ghana")) }
        }
    }
}

/// `openSheet('legal')`
struct LegalSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SheetScaffold {
            Eyebrow("Safety & legal boundaries")
            H2("Designed with care.")
            Para("Nourish is a food discovery and wellbeing product. It should provide general information and practical tools, not medical diagnosis or treatment.")

            VStack(alignment: .leading, spacing: 12) {
                section("Health information", "Content should use cautious language such as \u{201C}may\u{201D}, \u{201C}can\u{201D} and \u{201C}evidence suggests\u{201D}. Personal circumstances can change what is appropriate.")
                section("Allergies", "Allergy settings are treated as safety constraints, but no app can guarantee the absence of allergens or cross contamination. Users must check labels and trusted preparation information.")
                section("Medical conditions", "Labels such as \u{201C}kidney aware\u{201D} are discovery aids, not clinical clearance. Condition specific advice requires appropriately qualified professionals.")
                section("AI", "AI beta can explain and compare information but must not diagnose, prescribe or provide emergency guidance.")
                section("Images & culture", "Prototype images must be individually rights checked, correctly matched to the dish and credited where required. Cultural descriptions should be reviewed for accuracy and should never imply that one dish represents an entire people or country.")
            }
            .cardStyle()

            LegalCard(
                title: "Production requirement:",
                text: "Terms, Privacy Policy, consent language, data retention, content governance, clinical review where needed, advertising rules and jurisdiction specific legal review must be completed before launch."
            )

            PrimaryButton(title: "Close") { dismiss() }
        }
    }

    private func section(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            H3(title)
            Para(text, size: 12)
        }
    }
}
