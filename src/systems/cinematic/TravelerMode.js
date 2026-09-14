// =====================================================
//
// TRAVELER MODE
//
// =====================================================
//
// Human behavior interpreter.
//
// Translates raw XY pointer movement into intuitive
// Traveler movement.
//
// FreeFlight remains the technical movement engine.
//
// =====================================================

export class TravelerMode {
  interpret(moveX, moveY) {
    return {
      x: -moveX,

      y: -moveY,
    };
  }
}
