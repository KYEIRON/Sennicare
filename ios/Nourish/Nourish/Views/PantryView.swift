import SwiftUI

/// The Pantry tab — `pantryPage()` in the prototype.
struct PantryView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        PageScroll {
            intro
            kitchenGrid
            SmartKitchenBlock(text: smartText).padding(.top, 12)
            matchesSection
            bringYourKitchen
            NoticeBox(
                title: "Prototype:",
                "camera and receipt scanning are demonstrated with confirmation. Production AI should never silently change your pantry or shopping list."
            )
            .padding(.top, 20)
        }
    }

    private var smartText: String {
        store.pantry.isEmpty
            ? "Add a few things you already have, then see what you can make."
            : "You have \(store.pantry.count) things at home. Start with what you already own."
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your kitchen")
            H1("Know what you have. Discover what you can make.")
            Para("Pantry is where your kitchen starts. Keep what is already at home here, keep what you want to buy in Shopping, and let Nourish connect the two.")
        }
        .padding(.top, 12)
    }

    private var kitchenGrid: some View {
        HStack(spacing: 12) {
            KitchenCard(
                icon: "square.grid.2x2",
                title: "Pantry",
                subtitle: "\(store.pantry.count) items at home"
            ) { router.present(.pantry) }
            KitchenCard(
                icon: "basket",
                title: "Shopping",
                subtitle: "\(store.shopping.count) items to buy"
            ) { router.present(.shopping) }
        }
        .padding(.top, 16)
    }

    private var matchesSection: some View {
        Block {
            SectionLabel("You could make this")
            VStack(alignment: .leading, spacing: 12) {
                Para("Beautiful, pantry matched ideas should make the next meal feel obvious without taking away the joy of discovery.", size: 11)
                ForEach(Array(store.smartMatches().prefix(3))) { match in
                    PantryMatchRow(match: match) {
                        router.present(.meal(match.index))
                    }
                }
            }
            .cardStyle()
        }
    }

    private var bringYourKitchen: some View {
        Block {
            SectionLabel("Bring your kitchen with you")
            HStack(spacing: 12) {
                KitchenCard(icon: "plus.rectangle", title: "Add items", subtitle: "Type what you have.") {
                    router.present(.pantry)
                }
                KitchenCard(icon: "basket", title: "Shopping", subtitle: "Build your next shop.") {
                    router.present(.shopping)
                }
            }
        }
    }
}

/// `.pantryMatch`
struct PantryMatchRow: View {
    var match: AppStore.SmartMatch
    var action: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            RemoteImage(match.meal.img, height: 108, cornerRadius: 18)
                .frame(width: 108)
            VStack(alignment: .leading, spacing: 6) {
                Text("\(Int((match.score * 100).rounded()))% from your pantry")
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1)
                    .textCase(.uppercase)
                    .foregroundColor(Theme.sage)
                Text(match.meal.name)
                    .font(Serif.font(19))
                    .foregroundColor(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(match.meal.cal) kcal · \(match.meal.duration) min")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
                SecondaryButton(title: "Explore this meal", action: action)
            }
        }
        .padding(.vertical, 12)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .bottom)
    }
}
