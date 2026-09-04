import SwiftUI
import UIKit

/// Loads the prototype's photography from the exact same URLs (Unsplash and
/// Wikimedia Commons), with a memory + disk cache so a picture is fetched once
/// and then appears instantly everywhere it is used.
final class ImageCache {
    static let shared = ImageCache()

    private let memory = NSCache<NSString, UIImage>()
    private let folder: URL
    private let queue = DispatchQueue(label: "nourish.imagecache", qos: .utility)
    private var inFlight: [URL: [(UIImage?) -> Void]] = [:]

    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        folder = caches.appendingPathComponent("NourishImages", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        memory.countLimit = 160
    }

    private func fileURL(for url: URL) -> URL {
        let name = String(url.absoluteString.hashValue.magnitude, radix: 36)
        return folder.appendingPathComponent(name)
    }

    func cachedImage(for url: URL) -> UIImage? {
        memory.object(forKey: url.absoluteString as NSString)
    }

    func load(_ url: URL, completion: @escaping (UIImage?) -> Void) {
        if let hit = cachedImage(for: url) {
            completion(hit)
            return
        }
        if inFlight[url] != nil {
            inFlight[url]?.append(completion)
            return
        }
        inFlight[url] = [completion]

        queue.async { [weak self] in
            guard let self else { return }
            let disk = self.fileURL(for: url)
            if let data = try? Data(contentsOf: disk), let image = UIImage(data: data) {
                self.finish(url, image)
                return
            }
            var request = URLRequest(url: url)
            request.timeoutInterval = 25
            // Wikimedia asks API and file clients to identify themselves.
            request.setValue("Nourish/1.0 (iOS prototype)", forHTTPHeaderField: "User-Agent")
            URLSession.shared.dataTask(with: request) { data, _, _ in
                guard let data, let image = UIImage(data: data) else {
                    self.finish(url, nil)
                    return
                }
                try? data.write(to: disk, options: .atomic)
                self.finish(url, image)
            }.resume()
        }
    }

    private func finish(_ url: URL, _ image: UIImage?) {
        DispatchQueue.main.async {
            if let image { self.memory.setObject(image, forKey: url.absoluteString as NSString) }
            let waiting = self.inFlight[url] ?? []
            self.inFlight[url] = nil
            waiting.forEach { $0(image) }
        }
    }
}

/// A cover-cropped remote photograph with the prototype's soft placeholder.
struct RemoteImage: View {
    var url: URL?
    var height: CGFloat?
    var cornerRadius: CGFloat = 0

    init(url: URL?, height: CGFloat? = nil, cornerRadius: CGFloat = 0) {
        self.url = url
        self.height = height
        self.cornerRadius = cornerRadius
    }

    init(_ string: String?, height: CGFloat? = nil, cornerRadius: CGFloat = 0) {
        self.url = string.flatMap { URL(string: $0) }
        self.height = height
        self.cornerRadius = cornerRadius
    }

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                LinearGradient(
                    colors: [Color(hex: 0xE8EDE4), Theme.sand],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                if failed {
                    Image(systemName: "photo")
                        .font(.system(size: 20))
                        .foregroundColor(Theme.muted.opacity(0.6))
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .onAppear(perform: load)
        .onChange(of: url) { _ in
            image = nil
            failed = false
            load()
        }
    }

    private func load() {
        guard let url else {
            failed = true
            return
        }
        if let hit = ImageCache.shared.cachedImage(for: url) {
            image = hit
            return
        }
        ImageCache.shared.load(url) { loaded in
            if let loaded {
                image = loaded
            } else {
                failed = true
            }
        }
    }
}
