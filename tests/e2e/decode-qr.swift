// Decode generated PNGs with the native macOS QR detector. Never print invitations.
import Foundation
import CoreImage
let payload = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [String: String]
let png = Data(base64Encoded: payload["png"]!)!
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: CIContext(), options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let messages = detector.features(in: CIImage(data: png)!).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
print(messages.contains(payload["url"]!) ? "decoded" : "mismatch")
