import XCTest

final class TeleoUITests: XCTestCase {
  func testCreateEditAndReadNativeScript() throws {
    let app = XCUIApplication()
    app.launchArguments = ["--teleo-ui-test"]
    app.launch()
    let newButton = app.buttons["New script"]
    XCTAssertTrue(newButton.waitForExistence(timeout: 10))
    newButton.clickOrTap()
    let title = app.textFields["Script title"]
    XCTAssertTrue(title.waitForExistence(timeout: 5))
    title.clickOrTap()
    title.typeText("Native test")
    let editor = app.textViews["Script body"]
    XCTAssertTrue(editor.waitForExistence(timeout: 5))
    editor.clickOrTap()
    editor.typeText("Your words. Your pace.\n\nA second paragraph for reading.")
    #if os(iOS)
      app.buttons["Read"].tap()
    #else
      app.buttons["Read"].click()
    #endif
    XCTAssertTrue(app.buttons["Exit reader"].waitForExistence(timeout: 5))
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.lifetime = .keepAlways
    add(attachment)
    app.buttons["Play"].clickOrTap()
    XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 3))
    app.buttons["Pause"].clickOrTap()
    app.buttons["Exit reader"].clickOrTap()
  }
}
extension XCUIElement {
  fileprivate func clickOrTap() {
    #if os(macOS)
      click()
    #else
      tap()
    #endif
  }
}
