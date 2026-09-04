import SwiftUI

/// `.mealCardV10` — the horizontal rail card on Today.
struct MealCardV10: View {
    var meal: Meal
    var index: Int
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(meal.img, height: 178)
                VStack(alignment: .leading, spacing: 6) {
                    Text(meal.name)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(Theme.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(meal.cal) kcal · \(meal.meta)")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.muted)
                        .multilineTextAlignment(.leading)
                    MealTagRow(meal: meal)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 230)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// `.foodBig` — the two column card used across Food, Auth and the sheets.
struct FoodBigCard: View {
    var meal: Meal
    var width: CGFloat?
    var action: () -> Void

    init(meal: Meal, width: CGFloat? = nil, action: @escaping () -> Void) {
        self.meal = meal
        self.width = width
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(meal.img, height: 165)
                VStack(alignment: .leading, spacing: 5) {
                    Text(meal.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(Theme.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(meal.cal) kcal · \(meal.meta)")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.muted)
                        .multilineTextAlignment(.leading)
                    MealTagRow(meal: meal)
                }
                .padding(13)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: width)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 23, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// `mealTagsHtml(m)` — up to three fit tags.
struct MealTagRow: View {
    var meal: Meal

    var body: some View {
        let tags = Array((meal.fits ?? []).prefix(3))
        if !tags.isEmpty {
            HStack(spacing: 5) {
                ForEach(tags, id: \.self) { MealTag(text: $0) }
            }
            .padding(.top, 2)
        }
    }
}

/// A compact meal row used by the swap, move and day picker sheets.
struct MealRow: View {
    var meal: Meal
    var caption: String
    var buttonTitle: String
    var action: () -> Void

    var body: some View {
        HStack(spacing: 11) {
            RemoteImage(meal.img, height: 68, cornerRadius: 14)
                .frame(width: 82)
            VStack(alignment: .leading, spacing: 4) {
                Text(meal.name)
                    .font(Serif.font(17))
                    .foregroundColor(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(caption).font(.system(size: 10)).foregroundColor(Theme.muted)
                SecondaryButton(title: buttonTitle, fullWidth: false, action: action)
            }
            Spacer(minLength: 0)
        }
        .cardStyle()
    }
}

/// `.worldCard` — the "From somewhere new" rail on Food.
struct WorldCardView: View {
    var tile: WorldTile
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(tile.img, height: 120)
                VStack(alignment: .leading, spacing: 4) {
                    Text(tile.title).font(Serif.font(18)).foregroundColor(Theme.ink)
                    Text(tile.subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(Theme.muted)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(11)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 150)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// `.cultureCard` — the "Travel the world through food" rail on Today.
struct CultureCard: View {
    var place: String
    var caption: String
    var image: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(image, height: 132)
                VStack(alignment: .leading, spacing: 4) {
                    Text(place).font(.system(size: 15, weight: .bold)).foregroundColor(Theme.ink)
                    Text(caption)
                        .font(.system(size: 11))
                        .foregroundColor(Theme.muted)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 220)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// `.fitChip`
struct FitChip: View {
    var title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 10))
                .foregroundColor(Theme.ink)
                .padding(.vertical, 8)
                .padding(.horizontal, 11)
                .background(Theme.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// `.choice` / `.obChoice` — a selectable tile.
struct ChoiceTile: View {
    var title: String
    var subtitle: String?
    var selected: Bool
    var locked: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 13, weight: subtitle == nil ? .regular : .bold))
                    .foregroundColor(Theme.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                if let subtitle {
                    Text(subtitle).font(.system(size: 11)).foregroundColor(Theme.muted)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .background(selected ? Theme.sage2 : Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(selected ? Theme.sage : Theme.line, lineWidth: 1)
            )
            .opacity(locked ? 0.55 : 1)
        }
        .buttonStyle(.plain)
    }
}

/// `.kitchenCard`
struct KitchenCard: View {
    var icon: String
    var title: String
    var subtitle: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .light))
                    .foregroundColor(Theme.ink)
                    .frame(width: 34, height: 34)
                    .background(Theme.sage2)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                Text(title).font(Serif.font(23)).foregroundColor(Theme.ink)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(15)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 21, style: .continuous).stroke(Theme.line, lineWidth: 1))
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// `.smartKitchen` — the pantry teaser block reused on three tabs.
struct SmartKitchenBlock: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Smart kitchen")
                    H3("What can I make?")
                }
                Spacer()
                PremiumTag()
            }
            Para(text, size: 12)
            MiniItemList(items: Array(store.pantry.prefix(6)))
            PrimaryButton(title: "Find meals from my pantry") {
                router.present(.smartKitchen)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sage2.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }
}

/// `.miniList`
struct MiniItemList: View {
    var items: [String]

    var body: some View {
        let shown = items.isEmpty ? ["Add pantry items"] : items
        FlowLayout(spacing: 7) {
            ForEach(shown, id: \.self) { item in
                Text(item)
                    .font(.system(size: 10))
                    .foregroundColor(Color(hex: 0x57544D))
                    .padding(.vertical, 7)
                    .padding(.horizontal, 9)
                    .background(Theme.warmSurface)
                    .clipShape(Capsule())
            }
        }
    }
}

/// `.rewardCard`
struct RewardCard: View {
    var eyebrow: String
    var title: String
    var token: String
    var text: String
    var button: (title: String, action: () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(eyebrow)
                    H3(title)
                }
                Spacer(minLength: 8)
                Text(token)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Theme.sage)
                    .fixedSize()
            }
            Para(text, size: 12)
            if let button {
                SecondaryButton(title: button.title, action: button.action)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xF0EADF))
        .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 21, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }
}

/// A simple wrapping layout for chips and tags.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// The sheet chrome: the prototype's rounded sheet with a round close button.
struct SheetScaffold<Content: View>: View {
    @Environment(\.dismiss) private var dismiss
    var content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Theme.card.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    content()
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)
                .padding(.bottom, 40)
            }
            Button {
                dismiss()
            } label: {
                Text("×")
                    .font(.system(size: 22))
                    .foregroundColor(Theme.ink)
                    .frame(width: 36, height: 36)
                    .background(Color(hex: 0xEEEAE2))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
            .padding(.trailing, 18)
        }
    }
}

/// `.toast`
struct ToastView: View {
    var message: String

    var body: some View {
        Text(message)
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.white)
            .padding(.vertical, 11)
            .padding(.horizontal, 15)
            .background(Theme.ink.opacity(0.95))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: Theme.shadow, radius: 14, x: 0, y: 6)
            .padding(.horizontal, 24)
            .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
