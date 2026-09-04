import SwiftUI

/// Every overlay the prototype opens through `openSheet(type)`,
/// `openMeal(i)`, `openCulture(place)`, `openCountry(name)` and friends.
enum SheetRoute: Identifiable, Hashable {
    case meal(Int)
    case cooking(Int)
    case culture(String)
    case country(String)
    case morningDiscovery
    case ingredientDiscovery

    case pantry
    case shopping
    case smartKitchen
    case plus
    case planPreferences
    case profile

    case planDayPicker(Int)
    case mealPickerForDay(Int)
    case swap(String)
    case move(String)

    case morning
    case movement
    case breathing
    case recovery
    case discovery
    case aiSleep
    case aiEnergy
    case aiDecide
    case aiBeta
    case legal
    case wellbeingFood
    case sleep
    case cultureWellbeing

    var id: String {
        switch self {
        case .meal(let i): return "meal-\(i)"
        case .cooking(let i): return "cooking-\(i)"
        case .culture(let p): return "culture-\(p)"
        case .country(let c): return "country-\(c)"
        case .morningDiscovery: return "morningDiscovery"
        case .ingredientDiscovery: return "ingredientDiscovery"
        case .pantry: return "pantry"
        case .shopping: return "shopping"
        case .smartKitchen: return "smartKitchen"
        case .plus: return "plus"
        case .planPreferences: return "planPreferences"
        case .profile: return "profile"
        case .planDayPicker(let i): return "planDayPicker-\(i)"
        case .mealPickerForDay(let i): return "mealPickerForDay-\(i)"
        case .swap(let d): return "swap-\(d)"
        case .move(let d): return "move-\(d)"
        case .morning: return "morning"
        case .movement: return "movement"
        case .breathing: return "breathing"
        case .recovery: return "recovery"
        case .discovery: return "discovery"
        case .aiSleep: return "aiSleep"
        case .aiEnergy: return "aiEnergy"
        case .aiDecide: return "aiDecide"
        case .aiBeta: return "aiBeta"
        case .legal: return "legal"
        case .wellbeingFood: return "wellbeingFood"
        case .sleep: return "sleep"
        case .cultureWellbeing: return "cultureWellbeing"
        }
    }
}

/// Which tab is showing, and anything pushed on top of it.
enum Tab: String, CaseIterable {
    case today, food, pantry, plan, wellbeing, you

    var title: String {
        switch self {
        case .today: return "Today"
        case .food: return "Food"
        case .pantry: return "Pantry"
        case .plan: return "Plan"
        case .wellbeing: return "Wellbeing"
        case .you: return "You"
        }
    }

    var icon: String {
        switch self {
        case .today: return "house"
        case .food: return "fork.knife"
        case .pantry: return "list.bullet.rectangle"
        case .plan: return "calendar"
        case .wellbeing: return "heart"
        case .you: return "person"
        }
    }
}

/// A page pushed on top of a tab.
enum Page: Hashable {
    case filter(String)
}

final class Router: ObservableObject {
    @Published var tab: Tab = .today
    @Published var sheet: SheetRoute?
    @Published var path: [Page] = []

    /// Opening a sheet from inside another one: close the current sheet first
    /// so the new one always appears (mirrors the prototype's
    /// `closeSheet(); openMeal(i)`).
    func present(_ route: SheetRoute) {
        if sheet == nil {
            sheet = route
        } else {
            sheet = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) { [weak self] in
                self?.sheet = route
            }
        }
    }

    func dismiss() { sheet = nil }

    func show(_ tab: Tab) {
        sheet = nil
        path = []
        self.tab = tab
    }

    /// `closeSheet(); show('food')` — close the sheet, then switch tab.
    func closeAndShow(_ tab: Tab) {
        sheet = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            self?.path = []
            self?.tab = tab
        }
    }

    /// `filterFood(term)`
    func filterFood(_ term: String) {
        sheet = nil
        tab = .food
        path = [.filter(term)]
    }
}
