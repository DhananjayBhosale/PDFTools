# Page Override

## Screen

- Name: PDF document viewports (Reader, Sign PDF, Edit PDF)
- User goal: inspect and position content at a comfortable scale without zooming the surrounding application

## Deviations From Master

- Two-finger touch and Mac trackpad pinch continuously update the same bounded zoom value shown by the persistent zoom controls.
- The gesture midpoint stays anchored while the document grows or shrinks. Gesture zoom has no transition lag.
- One-finger scrolling, mouse-wheel scrolling, annotation manipulation, and keyboard or button zoom remain available.

## Constraints

- Pinch is captured only inside the PDF viewport; browser and application chrome do not scale.
- A completed pinch cannot trigger the page click action underneath it.
- The shared React behavior is packaged unchanged in browser, Android, and iOS shells.
- Zoom controls remain the keyboard and assistive-technology alternative to gestures.
