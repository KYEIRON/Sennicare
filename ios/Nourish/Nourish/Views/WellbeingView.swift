import SwiftUI

/// The Wellbeing tab — `wellbeing()` in the prototype.
struct WellbeingView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        PageScroll {
            intro
            hero
            aroundYourFood
            infoCard(
                eyebrow: "Sleep",
                title: "Make tonight a little gentler.",
                text: "Explore food timing, wind down ideas and simple routines. Your own response matters more than a rigid rule.",
                button: "Explore sleep",
                route: .sleep
            )
            infoCard(
                eyebrow: "Recovery",
                title: "Give your body room to recover.",
                text: "Pair nourishment with rest and manageable movement. Especially useful on days when your energy is different.",
                button: "Explore recovery",
                route: .recovery
            )
            infoCard(
                eyebrow: "Food & culture",
                title: "Wellbeing can look different around the world.",
                text: "Discover how meals, rituals, ingredients and everyday movement connect people and place.",
                button: "Explore a food tradition",
                route: .cultureWellbeing
            )
            kitchenRhythm
            aiBeta
            SourceNote("Wellbeing and AI beta provide general lifestyle and nutrition information only. They are not diagnosis, treatment or emergency services. Individual needs differ.")
                .padding(.top, 16)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Food for your life")
            H1("Wellbeing that belongs here.")
            Para("Food is where we begin. Wellbeing connects what you eat with how you move, rest, sleep, recover and enjoy everyday life.")
        }
        .padding(.top, 12)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            RemoteImage(NourishData.moveImage, height: 224)
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow("Your rhythm")
                H3("Eat. Move. Rest. Discover.")
                Para("Nourish does not separate food from life. Explore small ideas that can sit naturally alongside your meals and your day.")
                SecondaryButton(title: "Explore movement") { router.present(.movement) }
            }
            .padding(18)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        .padding(.top, 14)
    }

    private var aroundYourFood: some View {
        Block {
            SectionLabel("Around your food")
            HStack(spacing: 12) {
                KitchenCard(icon: "leaf", title: "Eat well", subtitle: "Ideas that fit real meals, not rules.") {
                    router.present(.wellbeingFood)
                }
                KitchenCard(icon: "wind", title: "Reset", subtitle: "A few quiet minutes when you need them.") {
                    router.present(.breathing)
                }
            }
        }
    }

    private func infoCard(eyebrow: String, title: String, text: String, button: String, route: SheetRoute) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(eyebrow)
            H3(title)
            Para(text)
            SecondaryButton(title: button) { router.present(route) }
        }
        .cardStyle()
        .padding(.top, 12)
    }

    private var kitchenRhythm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow("Your kitchen, your rhythm")
            H3("Have food at home?")
            Para("Tell Nourish what is in your pantry and it can help you find a meal that fits tonight.")
            PrimaryButton(title: "See what I can make") { router.present(.smartKitchen) }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sage2.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .padding(.top, 14)
    }

    /// `.aiBeta`
    private var aiBeta: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("AI beta")
                .font(.system(size: 9, weight: .heavy))
                .kerning(0.8)
                .textCase(.uppercase)
                .foregroundColor(.white)
                .padding(.vertical, 5)
                .padding(.horizontal, 8)
                .background(Theme.sage)
                .clipShape(Capsule())

            H2("Understand your food, without being told what to do.")
            Para("Explore how food, routines and everyday choices may relate to things such as sleep, energy or digestion. Nourish explains evidence with uncertainty and helps you think through choices. It does not diagnose, prescribe or replace professional care.")

            aiQuestion("Could this meal affect my sleep?", "Explore what is known and what is individual", "Explore", .aiSleep)
            aiQuestion("Why might I feel different after this?", "Separate observation from assumption", "Explore", .aiEnergy)
            aiQuestion("Help me compare these meals", "Nutrition, ingredients and practical fit", "Compare", .aiDecide)

            PrimaryButton(title: "Explore AI beta") { router.present(.aiBeta) }
                .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xEEF1E9))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Color(hex: 0xD9E1D5), lineWidth: 1))
        .padding(.top, 24)
    }

    private func aiQuestion(_ title: String, _ subtitle: String, _ action: String, _ route: SheetRoute) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 13, weight: .bold)).foregroundColor(Theme.ink)
                Text(subtitle).font(.system(size: 11)).foregroundColor(Theme.muted)
            }
            Spacer(minLength: 6)
            LinkButton(title: action) { router.present(route) }
        }
        .padding(.vertical, 12)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Color(hex: 0xDFE4DB)), alignment: .bottom)
    }
}
