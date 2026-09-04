import Foundation
import SwiftUI

/// The user's onboarding answers — the prototype's `nourishProfile`.
struct Profile: Codable, Equatable {
    var name: String?
    var dob: String?
    var age: String?
    var gender: String?
    var diet: String?
    var priorities: [String] = []
    var allergies: [String] = []
    var birthdaySurprises: Bool = true
}

/// A saved account — the prototype's `nourishAccount`.
struct Account: Codable, Equatable {
    var provider: String
    var email: String?
    var name: String?
    var createdAt: String
}

/// A planned day — the prototype's `nourishWeek` entries.
struct PlannedMeal: Codable, Equatable {
    var meal: Int
    var addedAt: String
}

/// Every piece of state the web prototype kept in `localStorage`, using the
/// same keys and the same rules.
final class AppStore: ObservableObject {
    static let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    let data = NourishData.shared

    @Published var profile = Profile()
    @Published var account: Account?
    @Published var pantry: [String] = []
    @Published var shopping: [String] = []
    @Published var shoppingDone: [String] = []
    @Published var week: [String: PlannedMeal] = [:]
    @Published var tokens: Int = 0
    @Published var plus: Bool = false
    @Published var explored: [Int] = []
    @Published var completed: [Int] = []
    @Published var toastMessage: String?

    private let defaults = UserDefaults.standard

    init() {
        profile = decode("nourishProfile") ?? Profile()
        account = decode("nourishAccount")
        pantry = decode("nourishPantry") ?? []
        shopping = decode("nourishShopping") ?? []
        shoppingDone = decode("nourishShoppingDone") ?? []
        week = decode("nourishWeek") ?? [:]
        tokens = defaults.integer(forKey: "nourishTokens")
        plus = defaults.string(forKey: "nourishPlus") == "1"
        explored = decode("nourishExplored") ?? []
        completed = decode("nourishCompleted") ?? []
    }

    var meals: [Meal] { data.meals }

    var isSignedIn: Bool { account != nil }

    // MARK: - Persistence helpers

    private func decode<T: Decodable>(_ key: String) -> T? {
        guard let raw = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: raw)
    }

    private func encode<T: Encodable>(_ value: T, _ key: String) {
        if let raw = try? JSONEncoder().encode(value) {
            defaults.set(raw, forKey: key)
        }
    }

    func saveProfile() { encode(profile, "nourishProfile") }
    func savePantry() { encode(pantry, "nourishPantry") }
    func saveShopping() {
        encode(shopping, "nourishShopping")
        encode(shoppingDone, "nourishShoppingDone")
    }
    func saveWeek() { encode(week, "nourishWeek") }

    // MARK: - Toast

    func toast(_ message: String) {
        toastMessage = message
        let shown = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { [weak self] in
            if self?.toastMessage == shown { self?.toastMessage = nil }
        }
    }

    // MARK: - Tokens

    func awardTokens(_ n: Int, _ reason: String) {
        tokens += n
        defaults.set(tokens, forKey: "nourishTokens")
        toast("+\(n) Nourish tokens · \(reason)")
    }

    func markMealComplete(_ i: Int) {
        if !completed.contains(i) {
            completed.append(i)
            encode(completed, "nourishCompleted")
            awardTokens(10, "meal cooked")
        } else {
            toast("Already completed.")
        }
    }

    func markExplored(_ i: Int) {
        guard !explored.contains(i) else { return }
        explored.append(i)
        encode(explored, "nourishExplored")
        awardTokens(2, "food explored")
    }

    // MARK: - Nourish+

    func setPlus(_ value: Bool) {
        plus = value
        defaults.set(value ? "1" : "0", forKey: "nourishPlus")
        toast(value ? "Nourish+ is active in this demo." : "Nourish+ preview is off.")
    }

    // MARK: - Account

    func signIn(provider: String, email: String? = nil, name: String? = nil) {
        let stamp = ISO8601DateFormatter().string(from: Date())
        account = Account(provider: provider, email: email, name: name ?? profile.name, createdAt: stamp)
        if let account { encode(account, "nourishAccount") }
    }

    /// `resetDemo()`
    func resetDemo() {
        for key in [
            "nourishProfile", "nourishAccount", "nourishShopping", "nourishPantry",
            "nourishShoppingDone", "nourishPlus", "nourishWeek", "nourishTokens",
            "nourishExplored", "nourishCompleted", "nourishLastDay", "nourishDailySeed"
        ] {
            defaults.removeObject(forKey: key)
        }
        profile = Profile()
        account = nil
        pantry = []
        shopping = []
        shoppingDone = []
        week = [:]
        tokens = 0
        plus = false
        explored = []
        completed = []
    }

    // MARK: - Date of birth → age band

    /// `setDob(v)`
    func setDob(_ value: String) {
        profile.dob = value.isEmpty ? nil : value
        profile.age = nil
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: value) {
            let years = Calendar.current.dateComponents([.year], from: date, to: Date()).year ?? 0
            if years >= 65 { profile.age = "65+" }
            else if years >= 55 { profile.age = "55–64" }
            else if years >= 45 { profile.age = "45–54" }
            else if years >= 35 { profile.age = "35–44" }
            else if years >= 25 { profile.age = "25–34" }
            else if years >= 18 { profile.age = "18–24" }
        }
        saveProfile()
    }

    // MARK: - Priorities and allergies

    func togglePriority(_ value: String) {
        if let idx = profile.priorities.firstIndex(of: value) {
            profile.priorities.remove(at: idx)
        } else {
            profile.priorities.append(value)
        }
        saveProfile()
    }

    /// `toggleAllergy(x)` — "None" clears the list.
    func toggleAllergy(_ value: String) {
        if value == "None" {
            profile.allergies = []
        } else {
            profile.allergies.removeAll { $0 == "None" }
            if let idx = profile.allergies.firstIndex(of: value) {
                profile.allergies.remove(at: idx)
            } else {
                profile.allergies.append(value)
            }
        }
        saveProfile()
    }

    // MARK: - Pantry and shopping

    /// `ingredientBase(x)`
    static func ingredientBase(_ value: String) -> String {
        var text = value.lowercased()
        let quantity = "\\b\\d+(?:[.,]\\d+)?\\s*(?:g|kg|ml|l|tbsp|tsp|handful|small|large|slice|slices|clove|cloves)\\b"
        text = text.replacingOccurrences(of: quantity, with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\([^)]*\\)", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "[^a-z\\s]", with: " ", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespaces)
    }

    /// `pantryHas(ingredient)`
    func pantryHas(_ ingredient: String) -> Bool {
        let base = AppStore.ingredientBase(ingredient)
        return pantry.contains { item in
            let q = AppStore.ingredientBase(item)
            guard !q.isEmpty else { return false }
            return (base.contains(q) || q.contains(base)) && base.count > 2 && q.count > 2
        }
    }

    struct SmartMatch: Identifiable {
        var meal: Meal
        var index: Int
        var have: Int
        var missing: [String]
        var score: Double
        var id: Int { index }
    }

    /// `smartMatches()`
    func smartMatches() -> [SmartMatch] {
        let all = mealRefs.map { ref -> SmartMatch in
            let meal = ref.meal
            let have = meal.ingredients.filter { pantryHas($0) }.count
            let missing = meal.ingredients.filter { !pantryHas($0) }
            let score = meal.ingredients.isEmpty ? 0 : Double(have) / Double(meal.ingredients.count)
            return SmartMatch(meal: meal, index: ref.index, have: have, missing: missing, score: score)
        }
        let sorted = all.sorted { a, b in
            if a.score != b.score { return a.score > b.score }
            return a.missing.count < b.missing.count
        }
        return Array(sorted.prefix(5))
    }

    func addPantryItem(_ value: String) {
        let item = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !item.isEmpty, !pantry.contains(item) else { return }
        pantry.append(item)
        savePantry()
        toast("\(item) added to your pantry.")
    }

    func removePantryItem(at index: Int) {
        guard pantry.indices.contains(index) else { return }
        pantry.remove(at: index)
        savePantry()
    }

    /// `addShopping(i)`
    func addShoppingForMeal(_ i: Int) {
        guard meals.indices.contains(i) else { return }
        let missing = meals[i].ingredients.filter { !pantryHas($0) }
        if missing.isEmpty {
            toast("You already have everything needed in your pantry.")
            return
        }
        for item in missing where !shopping.contains(item) { shopping.append(item) }
        saveShopping()
        toast("\(missing.count) missing ingredient\(missing.count == 1 ? "" : "s") added to your shopping list.")
    }

    func addShoppingText(_ text: String) {
        let items = text
            .components(separatedBy: CharacterSet(charactersIn: "\n,"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !items.isEmpty else { return }
        for item in items where !shopping.contains(item) { shopping.append(item) }
        saveShopping()
        toast("\(items.count) shopping item\(items.count == 1 ? "" : "s") added.")
    }

    func toggleShoppingItem(at index: Int) {
        guard shopping.indices.contains(index) else { return }
        let item = shopping[index]
        if let idx = shoppingDone.firstIndex(of: item) {
            shoppingDone.remove(at: idx)
        } else {
            shoppingDone.append(item)
        }
        saveShopping()
    }

    func removeShoppingItem(at index: Int) {
        guard shopping.indices.contains(index) else { return }
        let item = shopping[index]
        shopping.remove(at: index)
        shoppingDone.removeAll { $0 == item }
        saveShopping()
    }

    /// `handleScan(file, type)` — the prototype's demo scan.
    func demoScan(shoppingList: Bool) {
        let demo = shoppingList
            ? ["Bananas", "Avocado", "Brown rice", "Broccoli", "Chicken", "Greek yoghurt"]
            : ["Onions", "Tinned tomatoes", "Chickpeas", "Rice", "Spinach", "Eggs"]
        if shoppingList {
            for item in demo where !shopping.contains(item) { shopping.append(item) }
            saveShopping()
            toast("Demo scan added 6 shopping items. Review the list below.")
        } else {
            for item in demo where !pantry.contains(item) { pantry.append(item) }
            savePantry()
            toast("Demo scan found 6 kitchen items. Review the list below.")
        }
    }

    // MARK: - Weekly plan

    /// `plannedMealIndex(week, day)`
    func plannedMealIndex(_ day: String) -> Int? {
        guard let planned = week[day], meals.indices.contains(planned.meal) else { return nil }
        return planned.meal
    }

    /// `plannedDaysCount(week)`
    var plannedDaysCount: Int {
        AppStore.days.filter { plannedMealIndex($0) != nil }.count
    }

    var plannedCalories: Int {
        AppStore.days.compactMap { plannedMealIndex($0) }.reduce(0) { $0 + meals[$1].cal }
    }

    /// True when a free member has used their three planning days.
    func dayIsLocked(_ day: String) -> Bool {
        !plus && plannedMealIndex(day) == nil && plannedDaysCount >= 3
    }

    /// `replacePlanMeal(day, i)` — returns false when Nourish+ is required.
    @discardableResult
    func planMeal(_ i: Int, on day: String) -> Bool {
        let occupied = plannedMealIndex(day) != nil
        if !plus && !occupied && plannedDaysCount >= 3 { return false }
        week[day] = PlannedMeal(meal: i, addedAt: ISO8601DateFormatter().string(from: Date()))
        saveWeek()
        toast("\(meals[i].name) is now planned for \(day).")
        return true
    }

    /// `removePlanMeal(day)`
    func removePlanMeal(_ day: String) {
        week[day] = nil
        saveWeek()
        toast("\(day) is open again.")
    }

    /// `movePlanMeal(from, to)`
    func movePlanMeal(from: String, to: String) {
        guard let planned = week[from] else { return }
        week[to] = planned
        week[from] = nil
        saveWeek()
        toast("Meal moved to \(to).")
    }

    // MARK: - Today's rotation

    /// The prototype reseeds its meal rotation once a day and offsets the
    /// library by that seed.
    func dailyOffset() -> Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let key = formatter.string(from: Date())
        if defaults.string(forKey: "nourishLastDay") != key {
            defaults.set(key, forKey: "nourishLastDay")
            defaults.set(Int.random(in: 0..<100_000), forKey: "nourishDailySeed")
        }
        let seed = defaults.integer(forKey: "nourishDailySeed")
        return meals.isEmpty ? 0 : seed % meals.count
    }

    /// Every meal paired with its library index.
    var mealRefs: [MealRef] {
        meals.enumerated().map { MealRef(index: $0.offset, meal: $0.element) }
    }

    /// The four (or eight, with Plus) ideas shown for a meal slot today.
    func todaysMeals(slot: String, offset: Int) -> [MealRef] {
        let count = meals.count
        guard count > 0 else { return [] }
        let pairs = mealRefs.filter { $0.meal.slot == slot }
        let sorted = pairs.sorted { ($0.index + offset) % count < ($1.index + offset) % count }
        return Array(sorted.prefix(plus ? 8 : 4))
    }
}
