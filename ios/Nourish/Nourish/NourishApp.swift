import SwiftUI

@main
struct NourishApp: App {
    @StateObject private var store = AppStore()
    @StateObject private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(router)
                .preferredColorScheme(.light)
        }
    }
}

/// The prototype has three top level states: onboarding, the account screen
/// and the app itself. It skips straight to the app when a profile and an
/// account are already stored.
struct RootView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    @State private var stage: Stage = .loading

    enum Stage {
        case loading
        case onboarding
        case auth
        case app
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            switch stage {
            case .loading:
                Color.clear
            case .onboarding:
                OnboardingView { stage = .auth }
                    .transition(.opacity)
            case .auth:
                AuthView(
                    onBack: { stage = .onboarding },
                    onEnter: { stage = .app }
                )
                .transition(.opacity)
            case .app:
                AppShell()
                    .transition(.opacity)
            }

            if let message = store.toastMessage {
                VStack {
                    Spacer()
                    ToastView(message: message)
                        .padding(.bottom, 110)
                }
                .animation(.easeOut(duration: 0.2), value: store.toastMessage)
                .allowsHitTesting(false)
            }
        }
        .sheet(item: $router.sheet) { route in
            SheetHost(route: route)
                .environmentObject(store)
                .environmentObject(router)
        }
        .animation(.easeInOut(duration: 0.25), value: stage)
        .onAppear {
            guard stage == .loading else { return }
            stage = (store.isSignedIn && store.profile.diet != nil) ? .app : .onboarding
        }
        .onChange(of: store.account) { account in
            if account == nil && stage == .app { stage = .onboarding }
        }
    }
}

/// The signed in app: header, the six tabs, and every sheet.
struct AppShell: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router

    var body: some View {
        VStack(spacing: 0) {
            header
            NavigationStack(path: $router.path) {
                tabContent
                    .navigationDestination(for: Page.self) { page in
                        switch page {
                        case .filter(let term):
                            FilterFoodView(term: term)
                        }
                    }
            }
            TabBar()
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private var header: some View {
        HStack {
            Text("nourish")
                .font(Serif.font(29))
                .kerning(-0.6)
                .foregroundColor(Theme.ink)
            Spacer()
            Button {
                router.present(.profile)
            } label: {
                Text(initial)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Theme.ink)
                    .frame(width: 40, height: 40)
                    .background(Theme.card)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 22)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }

    private var initial: String {
        let name = store.profile.name ?? ""
        return name.isEmpty ? "R" : String(name.prefix(1)).uppercased()
    }

    @ViewBuilder
    private var tabContent: some View {
        switch router.tab {
        case .today: TodayView()
        case .food: FoodView()
        case .pantry: PantryView()
        case .plan: PlanView()
        case .wellbeing: WellbeingView()
        case .you: YouView()
        }
    }
}

/// `.tabs` — the six tab bar from the prototype.
struct TabBar: View {
    @EnvironmentObject var router: Router

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    router.show(tab)
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 18, weight: router.tab == tab ? .semibold : .regular))
                        Text(tab.title)
                            .font(.system(size: 10, weight: router.tab == tab ? .bold : .regular))
                    }
                    .foregroundColor(router.tab == tab ? Theme.ink : Color(hex: 0x85827A))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(height: 82, alignment: .top)
        .background(
            Theme.card.opacity(0.96)
                .overlay(Rectangle().frame(height: 1).foregroundColor(Theme.line), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

/// A scrolling page inside a tab, with the prototype's `main` padding.
struct PageScroll<Content: View>: View {
    var content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(Theme.bg)
        .scrollIndicators(.hidden)
    }
}

/// `.section` spacing.
struct Block<Content: View>: View {
    var top: CGFloat
    var content: () -> Content

    init(top: CGFloat = 26, @ViewBuilder content: @escaping () -> Content) {
        self.top = top
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, top)
    }
}
