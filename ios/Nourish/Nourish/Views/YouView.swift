import SwiftUI

/// The You tab — `you()` in the prototype.
struct YouView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    @State private var confirmReset = false

    var body: some View {
        PageScroll {
            intro
            profileCard
            kitchenCard
            plusCard
            safetyCard
            prototypeCard
        }
        .alert("Reset demo experience?", isPresented: $confirmReset) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) { store.resetDemo() }
        } message: {
            Text("This clears your profile, pantry, shopping list, plan and tokens on this device.")
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your Nourish")
            H1("Made for you")
            Para("Change your preferences whenever your life or priorities change.")
        }
        .padding(.top, 12)
    }

    private var profileSummary: String {
        let parts = [store.profile.name, store.profile.age, store.profile.gender].compactMap { $0 }
        return parts.isEmpty ? "Personalise Nourish" : parts.joined(separator: " · ")
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Profile")
                    H3(profileSummary)
                }
                Spacer(minLength: 8)
                LinkButton(title: "Edit") { router.present(.profile) }
            }
            FlowLayout(spacing: 7) {
                ForEach(pills, id: \.self) { PillTag(text: $0) }
            }
        }
        .cardStyle()
        .padding(.top, 14)
    }

    private var pills: [String] {
        var list = Array(store.profile.priorities.prefix(4))
        if list.isEmpty { list = ["Health priorities"] }
        list.append(store.profile.diet ?? "Food preferences")
        return list
    }

    private var kitchenCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your kitchen")
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    H3("Pantry & shopping")
                    Para("\(store.pantry.count) at home · \(store.shopping.count) to buy", size: 12)
                }
                Spacer(minLength: 8)
                LinkButton(title: "Open") { router.present(.pantry) }
            }
            HStack(spacing: 8) {
                SecondaryButton(title: "Pantry") { router.present(.pantry) }
                SecondaryButton(title: "Shopping list") { router.present(.shopping) }
            }
        }
        .cardStyle()
        .padding(.top, 12)
    }

    private var plusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("Nourish+")
            H3(store.plus ? "Nourish+ is active" : "More personal. Less mental load.")
            Para("Smart pantry planning, scans, ingredient rescue, personalised weeks, swaps, advanced nutrient goals and family planning.")
            PrimaryButton(title: store.plus ? "Manage Nourish+" : "Try free for 14 days") {
                router.present(.plus)
            }
            Text("$4.99/month or $39.99/year after trial.")
                .font(.system(size: 11))
                .foregroundColor(Theme.muted)
        }
        .cardStyle()
        .padding(.top, 12)
    }

    private var safetyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("Safety & legal")
            H3("Food and health deserve care.")
            Para("Nourish is designed to help people discover food and general nutrition information, not to diagnose, treat or give medical advice.")
            SecondaryButton(title: "Read safety boundaries") { router.present(.legal) }
        }
        .cardStyle()
        .padding(.top, 12)
    }

    private var prototypeCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow("Prototype")
            Button {
                confirmReset = true
            } label: {
                Text("Reset demo experience")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Theme.ink)
            }
            .buttonStyle(.plain)
        }
        .cardStyle()
        .padding(.top, 12)
    }
}
