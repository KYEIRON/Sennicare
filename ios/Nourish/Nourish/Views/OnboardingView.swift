import SwiftUI

/// The prototype's seven step onboarding, question for question.
struct OnboardingView: View {
    @EnvironmentObject var store: AppStore
    var onFinished: () -> Void

    init(onFinished: @escaping () -> Void) { self.onFinished = onFinished }

    @State private var step = 1

    private let priorities = [
        "Everyday health", "Healthy ageing", "Heart health", "Digestive comfort",
        "Blood sugar", "Healthy weight", "Strength & muscle", "Sleep",
        "Menopause", "Prostate", "Fertility", "Recovery",
        "Energy", "Brain health", "Bone health", "Eating more plants",
        "Easier meals", "Budget friendly food", "Family meals", "More variety"
    ]

    private let diets = [
        "Mostly plant based", "Omnivore", "Vegetarian", "Vegan", "Pescatarian",
        "Halal", "Kosher", "No preference", "Other"
    ]

    private let allergies = [
        "Peanuts", "Tree nuts", "Milk", "Eggs", "Fish", "Shellfish", "Wheat", "Soy", "None"
    ]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("nourish")
                        .font(Serif.font(29))
                        .kerning(-0.6)
                        .foregroundColor(Theme.ink)
                    progressBar
                    stepContent
                }
                .padding(.horizontal, 22)
                .padding(.top, 28)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)

            VStack(spacing: 8) {
                PrimaryButton(title: step == 7 ? "See my experience" : "Continue") { next() }
                if step > 1 {
                    SecondaryButton(title: "Back") { step -= 1 }
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 18)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(hex: 0xE8E4DB))
                Capsule()
                    .fill(Theme.sage)
                    .frame(width: geo.size.width * CGFloat(step) / 7.0)
            }
        }
        .frame(height: 4)
        .padding(.top, 25)
        .padding(.bottom, 34)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 1: stepIntro
        case 2: stepBirthday
        case 3: stepGender
        case 4: stepPriorities
        case 5: stepDiet
        case 6: stepAllergies
        default: stepReady
        }
    }

    // MARK: - Step 1

    private var stepIntro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("A better way to decide what to eat")
            H1("What should I eat today?")
            Para("That is the question Nourish is built around. Tell us a little about you and we will make the choices more relevant.")

            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(NourishData.onboardingHeroImage, height: 270)
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow("A first look")
                    Text("Food you'll want to discover.")
                        .font(Serif.font(29))
                        .foregroundColor(Theme.ink)
                    Para("Personalised meal ideas, new foods and simple ways to plan your week without taking the thinking out of your hands.", size: 15)
                    VStack(alignment: .leading, spacing: 0) {
                        adPoint("01", "See something worth trying", "New meals shaped around what you enjoy.")
                        adPoint("02", "Make it fit your life", "Time, preferences, priorities and ingredients can all shape what appears.")
                        adPoint("03", "Keep discovering", "The more you use Nourish, the more useful its recommendations can become.")
                    }
                    .padding(.top, 8)
                }
                .padding(20)
            }
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
            .padding(.top, 22)

            Text("About a minute to get started.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
                .padding(.top, 10)
        }
    }

    private func adPoint(_ number: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Text(number)
                .font(.system(size: 10, weight: .heavy))
                .foregroundColor(Theme.sage)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 14, weight: .bold)).foregroundColor(Theme.ink)
                Para(text, size: 12)
            }
        }
        .padding(.vertical, 12)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .top)
    }

    // MARK: - Step 2

    private var stepBirthday: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("About you · 1 of 5")
            H1("When were you born?")
            Para("Your date of birth helps us understand your life stage and, if you choose, celebrate your birthday with something special.")

            DateOfBirthPicker()

            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Birthday surprises").font(.system(size: 14, weight: .bold)).foregroundColor(Theme.ink)
                    Para("Let Nourish prepare a thoughtful food or wellbeing idea around your birthday.", size: 11)
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

            Text("You can change this later. Your exact date of birth is not shown publicly.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
        }
    }

    // MARK: - Step 3

    private var stepGender: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("About you · 2 of 5")
            H1("How should Nourish understand you?")
            choiceGrid(["Woman", "Man", "Non binary", "Prefer not to say"], columns: 2) { option in
                store.profile.gender == option
            } action: { option in
                store.profile.gender = option
                store.saveProfile()
            }
            Text("This can help us make some content more relatable. You can change it later.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
                .padding(.top, 4)
        }
    }

    // MARK: - Step 4

    private var stepPriorities: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your priorities · 3 of 5")
            H1("What would you like more help with?")
            Para("Choose anything that feels relevant. These guide what we put in front of you, not what you are told to do.")
            choiceGrid(priorities, columns: 2) { option in
                store.profile.priorities.contains(option)
            } action: { option in
                store.togglePriority(option)
            }
        }
    }

    // MARK: - Step 5

    private var stepDiet: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Food preferences · 4 of 5")
            H1("How do you like to eat?")
            Para("There is no right answer. We want to understand your pattern, not put you in a box.")
            choiceGrid(diets, columns: 2) { option in
                store.profile.diet == option
            } action: { option in
                store.profile.diet = option
                store.saveProfile()
            }
        }
    }

    // MARK: - Step 6

    private var stepAllergies: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Food safety · 5 of 5")
            H1("Anything you must avoid?")
            Para("Allergies are safety constraints, not preferences. Select everything that applies.")
            choiceGrid(allergies, columns: 2) { option in
                option == "None" ? (store.profile.allergies.isEmpty && allergiesTouched) : store.profile.allergies.contains(option)
            } action: { option in
                allergiesTouched = true
                store.toggleAllergy(option)
            }
            Text("Always check packaged food labels and seek professional advice for severe allergies.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
        }
    }

    @State private var allergiesTouched = false

    // MARK: - Step 7

    private var stepReady: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your experience")
            H1(store.profile.diet == "Mostly plant based"
               ? "A flexible, mostly plant based experience."
               : "A more personal food experience is ready.")
            Para(readyText)

            VStack(alignment: .leading, spacing: 0) {
                readyItem("01", readyMealName, readyMealMeta)
                readyItem("02", "Three ideas, not one answer", "Different options give you something to choose from.")
                readyItem("03", "A week that learns your pattern", "Save, swap, plan and let your choices shape what appears next.")
            }
            .padding(.top, 6)

            Text("You stay in control. Preferences can be changed at any time.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
                .padding(.top, 8)
        }
    }

    private var readyText: String {
        let first = store.profile.priorities.first
        let prefix = first.map { "\($0) can shape what appears first. " } ?? ""
        return prefix + "Here is a first glimpse of what your experience could feel like."
    }

    private var readyMealName: String {
        store.meals.indices.contains(6) ? store.meals[6].name : "A meal you may like"
    }

    private var readyMealMeta: String {
        guard store.meals.indices.contains(6) else { return "Based on what you told us." }
        let meal = store.meals[6]
        let diet = store.profile.diet ?? "Your food preferences"
        let priority = store.profile.priorities.first ?? "Everyday health"
        return "\(meal.cal) kcal · \(diet) · \(priority)"
    }

    private func readyItem(_ number: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.system(size: 9, weight: .heavy))
                .foregroundColor(Color(hex: 0x4C5848))
                .frame(width: 26, height: 26)
                .background(Theme.sage2)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 15, weight: .bold)).foregroundColor(Theme.ink)
                Para(text, size: 12)
            }
        }
        .padding(.vertical, 14)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .bottom)
    }

    // MARK: - Shared grid

    private func choiceGrid(
        _ options: [String],
        columns: Int,
        selected: @escaping (String) -> Bool,
        action: @escaping (String) -> Void
    ) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 9), count: columns), spacing: 9) {
            ForEach(options, id: \.self) { option in
                ChoiceTile(title: option, subtitle: nil, selected: selected(option)) {
                    action(option)
                }
            }
        }
    }

    // MARK: - Validation, mirroring validateOb()

    private func next() {
        guard validate() else { return }
        store.saveProfile()
        if step < 7 {
            step += 1
        } else {
            onFinished()
        }
    }

    private func validate() -> Bool {
        var message = ""
        if step == 2 && (store.profile.dob ?? "").isEmpty {
            message = "Add your date of birth to continue."
        }
        if step == 2 && !(store.profile.dob ?? "").isEmpty && store.profile.age == nil {
            message = "Please enter a valid date. You need to be 18 or over to use Nourish."
        }
        if step == 3 && store.profile.gender == nil { message = "Choose an option to continue." }
        if step == 4 && store.profile.priorities.isEmpty { message = "Choose at least one priority." }
        if step == 5 && store.profile.diet == nil { message = "Choose how you like to eat." }
        if step == 6 && store.profile.allergies.isEmpty && !allergiesTouched {
            message = "Choose None if you have no allergies."
        }
        if !message.isEmpty {
            store.toast(message)
            return false
        }
        return true
    }
}

/// The prototype's three column day / month / year scroller.
struct DateOfBirthPicker: View {
    @EnvironmentObject var store: AppStore

    @State private var day = 1
    @State private var month = 1
    @State private var year = Calendar.current.component(.year, from: Date()) - 30
    @State private var chosen = false

    private let months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    private var years: [Int] {
        let now = Calendar.current.component(.year, from: Date())
        return Array((now - 100)...(now - 18)).reversed()
    }

    var body: some View {
        VStack(spacing: 9) {
            HStack(spacing: 8) {
                picker(width: 0.28) {
                    Picker("Day", selection: $day) {
                        ForEach(1...31, id: \.self) { Text("\($0)").tag($0) }
                    }
                }
                picker(width: 0.38) {
                    Picker("Month", selection: $month) {
                        ForEach(1...12, id: \.self) { Text(months[$0 - 1]).tag($0) }
                    }
                }
                picker(width: 0.34) {
                    Picker("Year", selection: $year) {
                        ForEach(years, id: \.self) { Text(String($0)).tag($0) }
                    }
                }
            }
            Text(preview)
                .font(.system(size: 12))
                .foregroundColor(Theme.muted)
                .frame(maxWidth: .infinity)
        }
        .onAppear(perform: restore)
        .onChange(of: day) { _ in commit() }
        .onChange(of: month) { _ in commit() }
        .onChange(of: year) { _ in commit() }
    }

    private func picker<Content: View>(width: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .pickerStyle(.menu)
            .tint(Theme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    private var preview: String {
        guard chosen else { return "Select your date of birth" }
        return "\(day) \(months[month - 1]) \(year)"
    }

    private func restore() {
        guard let dob = store.profile.dob else { return }
        let parts = dob.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return }
        year = parts[0]
        month = parts[1]
        day = parts[2]
        chosen = true
    }

    private func commit() {
        chosen = true
        store.setDob(String(format: "%04d-%02d-%02d", year, month, day))
    }
}
