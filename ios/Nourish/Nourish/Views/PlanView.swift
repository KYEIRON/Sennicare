import SwiftUI

/// The Plan tab — `plan(view)` in the prototype, with its week, calendar and
/// list views.
struct PlanView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    @State private var view = "week"

    var body: some View {
        PageScroll {
            intro
            viewSwitcher
            summary
            insight
            if !store.plus { gate }
            planBody(for: view)
            SourceNote("Prototype nutrition and planning figures are illustrative. Production values require verified food data and appropriate review.")
                .padding(.top, 16)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Plan")
            H1("Your week, made easier")
            Para("Plan ahead, change your mind and keep the whole week visible. Nourish should fit the way you actually cook.")
        }
        .padding(.top, 12)
    }

    private var viewSwitcher: some View {
        HStack(spacing: 7) {
            ForEach(["week", "calendar", "list"], id: \.self) { option in
                Button {
                    view = option
                } label: {
                    Text(option.capitalized)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(view == option ? .white : Theme.ink)
                        .padding(.vertical, 9)
                        .padding(.horizontal, 13)
                        .background(view == option ? Theme.ink : Theme.card)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(view == option ? Theme.ink : Theme.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.top, 16)
    }

    private var summary: some View {
        HStack(spacing: 10) {
            planStat("\(store.plannedCalories)", "planned kcal")
            planStat("\(store.plannedDaysCount)/7", "days planned")
            planStat(store.plus ? "Full week" : "3 days", store.plus ? "Nourish+ access" : "free planning")
        }
        .padding(.top, 12)
    }

    private func planStat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(Serif.font(21)).foregroundColor(Theme.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    private var insight: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Plan around your real cooking rhythm.")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Theme.ink)
            Para("Research suggests many people plan only a few days ahead, while weekday meals often need convenience and weekends can allow more time. Nourish should learn each person's actual rhythm rather than assume one perfect cooking schedule.", size: 12)
        }
        .surfaceStyle(Theme.warmSurfaceAlt, padding: 15, radius: 20)
        .padding(.top, 12)
    }

    private var gate: some View {
        PlusGate(
            title: "Three planning days free. Seven with Nourish+.",
            text: "Everyone can explore the whole week. Plus unlocks all seven planning days, deeper meal variations and flexible swaps and changes.",
            buttonTitle: "Explore Nourish+"
        ) { router.present(.plus) }
        .padding(.top, 14)
    }

    @ViewBuilder
    private func planBody(for view: String) -> some View {
        switch view {
        case "calendar": calendarGrid
        case "list": listView
        default: weekGrid
        }
    }

    // MARK: - Week

    private var weekGrid: some View {
        VStack(spacing: 12) {
            ForEach(AppStore.days.indices, id: \.self) { index in
                weekDay(day: AppStore.days[index], index: index)
            }
        }
        .padding(.top, 14)
    }

    private func weekDay(day: String, index: Int) -> some View {
        let planned = store.plannedMealIndex(day)
        let locked = store.dayIsLocked(day)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(day).font(.system(size: 14, weight: .bold)).foregroundColor(Theme.ink)
                Spacer()
                Text(planned.map { "\(store.meals[$0].cal) kcal" } ?? "Open")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.muted)
            }

            if let planned {
                Button {
                    router.present(.meal(planned))
                } label: {
                    HStack(spacing: 11) {
                        RemoteImage(store.meals[planned].img, height: 56, cornerRadius: 13)
                            .frame(width: 72)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(store.meals[planned].name)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Theme.ink)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("\(store.meals[planned].slot) · \(store.meals[planned].duration) min")
                                .font(.system(size: 10))
                                .foregroundColor(Theme.muted)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)

                HStack(spacing: 8) {
                    SecondaryButton(title: "Swap") { router.present(.swap(day)) }
                    SecondaryButton(title: "Move") { router.present(.move(day)) }
                    SecondaryButton(title: "Remove") { store.removePlanMeal(day) }
                }
            } else if locked {
                Text("Unlock this day with Nourish+.")
                    .font(.system(size: 12))
                    .foregroundColor(Theme.muted)
                    .padding(.vertical, 8)
            } else {
                SecondaryButton(title: "Add a meal") { router.present(.mealPickerForDay(index)) }
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .opacity(locked ? 0.7 : 1)
    }

    // MARK: - Calendar

    private var calendarGrid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
        return VStack(spacing: 8) {
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(AppStore.days, id: \.self) { day in
                    Text(String(day.prefix(3)))
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundColor(Theme.muted)
                }
                ForEach(AppStore.days.indices, id: \.self) { index in
                    let day = AppStore.days[index]
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(index + 1)").font(.system(size: 11, weight: .bold)).foregroundColor(Theme.ink)
                        Text(store.plannedMealIndex(day).map { store.meals[$0].name } ?? "Free")
                            .font(.system(size: 8))
                            .foregroundColor(Theme.muted)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                    }
                    .padding(6)
                    .frame(maxWidth: .infinity, minHeight: 80, alignment: .topLeading)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.line, lineWidth: 1))
                }
            }
        }
        .padding(.top, 14)
    }

    // MARK: - List

    private var listView: some View {
        VStack(spacing: 10) {
            ForEach(AppStore.days.indices, id: \.self) { index in
                let day = AppStore.days[index]
                if let planned = store.plannedMealIndex(day) {
                    MealRow(
                        meal: store.meals[planned],
                        caption: "\(day) · \(store.meals[planned].cal) kcal · \(store.meals[planned].duration) min",
                        buttonTitle: "Open meal"
                    ) { router.present(.meal(planned)) }
                } else {
                    HStack {
                        Text(day).font(.system(size: 13, weight: .bold)).foregroundColor(Theme.ink)
                        Spacer()
                        if store.dayIsLocked(day) {
                            Text("Nourish+").font(.system(size: 11)).foregroundColor(Theme.muted)
                        } else {
                            LinkButton(title: "Add a meal") { router.present(.mealPickerForDay(index)) }
                        }
                    }
                    .padding(15)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.line, lineWidth: 1))
                }
            }
        }
        .padding(.top, 14)
    }
}
