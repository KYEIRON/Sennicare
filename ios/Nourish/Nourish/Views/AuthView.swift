import SwiftUI

/// "Keep your Nourish experience." — the account screen shown after onboarding.
struct AuthView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var onBack: () -> Void
    var onEnter: () -> Void

    init(onBack: @escaping () -> Void, onEnter: @escaping () -> Void) {
        self.onBack = onBack
        self.onEnter = onEnter
    }

    @State private var showEmail = false
    @State private var mode = "signup"
    @State private var name = ""
    @State private var email = ""
    @State private var error = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    intro
                    experienceHero
                    topActions
                    foodTitle
                    foodRail
                    stats
                    footnote
                    if showEmail { emailForm } else { providerButtons }
                }
                .padding(.horizontal, 22)
                .padding(.top, 28)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)

            SecondaryButton(title: "Back") { onBack() }
                .padding(.horizontal, 22)
                .padding(.bottom, 18)
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    @ViewBuilder
    private var intro: some View {
        Text("nourish")
            .font(Serif.font(29))
            .kerning(-0.6)
            .foregroundColor(Theme.ink)

        Capsule()
            .fill(Theme.sage)
            .frame(height: 4)
            .padding(.vertical, 25)

        Eyebrow("A first taste of your Nourish")
        H1("Keep your Nourish experience.")
        Para("We've started shaping a world around what you told us. Take a look before you decide.")
    }

    private var foodTitle: some View {
        HStack(alignment: .bottom) {
            H3("What could be on your table?")
            Spacer(minLength: 8)
            Text("Tap anything to explore")
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)
                .fixedSize()
        }
        .padding(.top, 18)
    }

    @ViewBuilder
    private var footnote: some View {
        Text("Your choices can change what you discover over time. You stay in control.")
            .font(.system(size: 10))
            .foregroundColor(Theme.muted)
            .padding(.top, 12)

        Text(store.profile.diet ?? "Flexible eating")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(Color(hex: 0x475143))
            .padding(.vertical, 7)
            .padding(.horizontal, 11)
            .background(Theme.sage2)
            .clipShape(Capsule())
            .padding(.top, 10)
    }

    private var experienceHero: some View {
        VStack(alignment: .leading, spacing: 0) {
            RemoteImage(NourishData.authHeroImage, height: 205)
            VStack(alignment: .leading, spacing: 7) {
                Text("Made around you").eyebrowStyle()
                Text("Three places to start.")
                    .font(Serif.font(25))
                    .foregroundColor(Theme.ink)
                Para("One familiar. One different. One that might introduce you to something you have never made before.")
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
        .padding(.top, 16)
    }

    private var topActions: some View {
        VStack(spacing: 8) {
            PrimaryButton(title: "Continue with Apple") { demoAuth("Apple") }
            SecondaryButton(title: "Continue with email") {
                mode = "signup"
                showEmail = true
            }
        }
        .padding(.top, 14)
    }

    /// `updateAuthCopy()` shows meals 0, 4 and 7.
    private var foodRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach([0, 4, 7], id: \.self) { index in
                    if store.meals.indices.contains(index) {
                        FoodBigCard(meal: store.meals[index], width: 205) {
                            router.present(.meal(index))
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .padding(.top, 10)
    }

    private var stats: some View {
        HStack(spacing: 10) {
            statBox(String(max(1, store.profile.priorities.count)), "personal priorities")
            statBox("3", "starting ideas")
            statBox("∞", "ways to explore")
        }
        .padding(.top, 12)
    }

    private func statBox(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(Serif.font(22)).foregroundColor(Theme.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    private var providerButtons: some View {
        VStack(spacing: 10) {
            authProvider(mark: "●", title: "Continue with Apple") { demoAuth("Apple") }
            authProvider(mark: "G", title: "Continue with Google") { demoAuth("Google") }

            HStack(spacing: 10) {
                Rectangle().frame(height: 1).foregroundColor(Theme.line)
                Text("or").font(.system(size: 11)).foregroundColor(Theme.muted)
                Rectangle().frame(height: 1).foregroundColor(Theme.line)
            }
            .padding(.vertical, 2)

            PrimaryButton(title: "Continue with email") {
                mode = "signup"
                showEmail = true
            }

            Text("By continuing, you agree to Nourish's Terms and Privacy Policy.")
                .font(.system(size: 10))
                .foregroundColor(Theme.muted)

            Button {
                mode = "signin"
                showEmail = true
            } label: {
                Text("Already have an account? ").font(.system(size: 12)).foregroundColor(Theme.muted)
                + Text("Sign in").font(.system(size: 12, weight: .bold)).foregroundColor(Theme.ink)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 16)
    }

    private func authProvider(mark: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(mark).font(.system(size: 15, weight: .bold))
                Text(title).font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(Theme.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var emailForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if mode == "signup" {
                field(label: "Name", placeholder: "Your name", text: $name)
            }
            field(label: "Email", placeholder: "you@example.com", text: $email, keyboard: .emailAddress)

            if !error.isEmpty {
                Text(error).font(.system(size: 11, weight: .semibold)).foregroundColor(Color(hex: 0xB4553F))
            }

            PrimaryButton(title: mode == "signup" ? "Create my account" : "Sign in") { submit() }

            Button {
                showEmail = false
                error = ""
            } label: {
                Text("Back to other options").font(.system(size: 12)).foregroundColor(Theme.muted)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 16)
    }

    private func field(
        label: String,
        placeholder: String,
        text: Binding<String>,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundColor(Theme.muted)
            TextField(placeholder, text: text)
                .font(.system(size: 15))
                .keyboardType(keyboard)
                .autocorrectionDisabled()
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                .padding(14)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(Theme.line, lineWidth: 1))
        }
    }

    // MARK: - Actions

    private func demoAuth(_ provider: String) {
        store.signIn(provider: provider)
        store.toast("Demo account created with \(provider).")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { onEnter() }
    }

    /// `submitEmailAuth()`
    private func submit() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let valid = trimmedEmail.range(of: "^\\S+@\\S+\\.\\S+$", options: .regularExpression) != nil
        if !valid {
            error = "Please enter a valid email address."
            return
        }
        if mode == "signup" && trimmedName.isEmpty {
            error = "Please enter your name."
            return
        }
        error = ""
        if !trimmedName.isEmpty {
            store.profile.name = trimmedName
            store.saveProfile()
        }
        store.signIn(provider: "Email", email: trimmedEmail, name: trimmedName)
        store.toast(mode == "signup" ? "Your account is ready." : "Signed in successfully.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { onEnter() }
    }
}
