import assert from "node:assert/strict";
import * as THREE from "three";
import { SpaceFlight } from "../src/systems/SpaceFlight.js";
import { GalaxyFlight } from "../src/systems/GalaxyFlight.js";

const FRAME_DELTA = 1 / 60;
const TOLERANCE = 1e-9;
const POINTER_START = Object.freeze({ x: 100, y: 100 });
const PIVOT = new THREE.Vector3(3, -2, 5);
const ORBIT_OFFSET = new THREE.Vector3(4, 5, 7);
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);

function approximately(actual, expected, message, tolerance = TOLERANCE) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorApproximately(actual, expected, message, tolerance = TOLERANCE) {
  approximately(actual.x, expected.x, `${message}.x`, tolerance);
  approximately(actual.y, expected.y, `${message}.y`, tolerance);
  approximately(actual.z, expected.z, `${message}.z`, tolerance);
}

function rounded(value) {
  return Number(value.toFixed(9));
}

function vectorTrace(vector) {
  return [rounded(vector.x), rounded(vector.y), rounded(vector.z)];
}

function makeRoot(scale) {
  const root = new THREE.Group();
  root.position.copy(PIVOT);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  return root;
}

function makeContext() {
  const basePosition = PIVOT.clone().add(ORBIT_OFFSET);
  return {
    basePosition,
    currentPosition: basePosition.clone(),
  };
}

function step(
  flight,
  context,
  {
    delta = FRAME_DELTA,
    horizontalMovement = 0,
    pointerX = POINTER_START.x,
    pointerY = POINTER_START.y,
    lmb = false,
    rmb = false,
    chorded = false,
  } = {},
) {
  flight.updateRmbPointer({
    x: pointerX,
    y: pointerY,
    hasPosition: true,
  }, rmb);
  flight.update(
    delta,
    horizontalMovement,
    pointerY,
    lmb,
    rmb,
    chorded,
    context.currentPosition,
    context.basePosition,
    FORWARD,
    RIGHT,
  );
  context.currentPosition
    .copy(context.basePosition)
    .add(flight.displacement);
}

function newCase(spec) {
  return {
    flight: spec.createFlight(),
    context: makeContext(),
  };
}

function beginOrbit(flight, context) {
  step(flight, context, { lmb: true });
}

function orbitCase(spec, horizontalMovement, pointerY) {
  const testCase = newCase(spec);
  beginOrbit(testCase.flight, testCase.context);
  const initialAngle = testCase.flight.orbitAngle;
  const initialElevation = testCase.flight.orbitElevation;
  step(testCase.flight, testCase.context, {
    horizontalMovement,
    pointerY,
    lmb: true,
  });
  return { ...testCase, initialAngle, initialElevation };
}

function rmbCase(spec, pointerX, pointerY) {
  const testCase = newCase(spec);
  step(testCase.flight, testCase.context, { rmb: true });
  step(testCase.flight, testCase.context, {
    pointerX,
    pointerY,
    rmb: true,
  });
  return testCase;
}

function characterize(spec) {
  const trace = {};

  const initial = newCase(spec);
  vectorApproximately(initial.flight.displacement, new THREE.Vector3(), "initial displacement");
  assert.equal(initial.flight.orbiting, false, "initial orbit state");
  assert.equal(initial.flight.hasRmbPointerStart, false, "initial RMB state");
  approximately(initial.flight.rmbThrustVelocity, 0, "initial thrust velocity");
  approximately(initial.flight.rmbStrafeVelocity, 0, "initial strafe velocity");
  approximately(initial.flight.rmbMaxSpeed, spec.maxSpeed, "theme maximum speed");
  approximately(initial.flight.travelLimit, spec.travelLimit, "theme travel envelope");
  approximately(initial.flight.orbitAngularSensitivity, 0.002, "azimuth sensitivity");
  approximately(initial.flight.orbitElevationSensitivity, 0.002, "elevation sensitivity");
  approximately(initial.flight.rmbAcceleration, 7, "RMB acceleration");
  approximately(initial.flight.rmbBraking, 11, "RMB braking");
  approximately(initial.flight.rmbThrustSensitivity, 0.08, "RMB thrust sensitivity");
  approximately(initial.flight.rmbStrafeSensitivity, 0.08, "RMB strafe sensitivity");
  approximately(initial.flight.rmbDeadZone, 3, "RMB dead zone");
  approximately(initial.flight.rmbStopEpsilon, 0.01, "RMB stop epsilon");
  trace.initial = {
    displacement: vectorTrace(initial.flight.displacement),
    orbiting: initial.flight.orbiting,
    rmbActive: initial.flight.hasRmbPointerStart,
  };

  const zeroPress = newCase(spec);
  const positionBeforePress = zeroPress.context.currentPosition.clone();
  beginOrbit(zeroPress.flight, zeroPress.context);
  vectorApproximately(
    zeroPress.context.currentPosition,
    positionBeforePress,
    "zero-movement LMB press must not snap",
  );
  approximately(
    zeroPress.flight.orbitRadius,
    ORBIT_OFFSET.length(),
    "initial spherical radius",
  );
  assert.equal(zeroPress.flight.orbiting, true, "LMB activates orbit");
  trace.initialRadius = rounded(zeroPress.flight.orbitRadius);
  trace.zeroMovementPress = {
    displacement: vectorTrace(zeroPress.flight.displacement),
    angle: rounded(zeroPress.flight.orbitAngle),
    elevation: rounded(zeroPress.flight.orbitElevation),
    orbiting: zeroPress.flight.orbiting,
  };

  const left = orbitCase(spec, -20, POINTER_START.y);
  const right = orbitCase(spec, 20, POINTER_START.y);
  approximately(
    left.flight.orbitAngle - left.initialAngle,
    0.04,
    "accepted mouse-left azimuth sign",
  );
  approximately(
    right.flight.orbitAngle - right.initialAngle,
    -0.04,
    "accepted mouse-right azimuth sign",
  );
  trace.leftAngleDelta = rounded(left.flight.orbitAngle - left.initialAngle);
  trace.rightAngleDelta = rounded(right.flight.orbitAngle - right.initialAngle);

  const up = orbitCase(spec, 0, POINTER_START.y - 20);
  const down = orbitCase(spec, 0, POINTER_START.y + 20);
  approximately(
    up.flight.orbitElevation - up.initialElevation,
    -0.04,
    "accepted mouse-up elevation sign",
  );
  approximately(
    down.flight.orbitElevation - down.initialElevation,
    0.04,
    "accepted mouse-down elevation sign",
  );
  trace.upElevationDelta = rounded(up.flight.orbitElevation - up.initialElevation);
  trace.downElevationDelta = rounded(down.flight.orbitElevation - down.initialElevation);

  const diagonal = orbitCase(spec, -20, POINTER_START.y - 20);
  approximately(
    diagonal.flight.orbitAngle - diagonal.initialAngle,
    0.04,
    "diagonal azimuth component",
  );
  approximately(
    diagonal.flight.orbitElevation - diagonal.initialElevation,
    -0.04,
    "diagonal elevation component",
  );
  approximately(
    diagonal.context.currentPosition.distanceTo(PIVOT),
    diagonal.flight.orbitRadius,
    "spherical radius after diagonal orbit",
  );
  trace.diagonalRadius = rounded(diagonal.context.currentPosition.distanceTo(PIVOT));
  trace.diagonalOrbitDisplacement = vectorTrace(diagonal.flight.displacement);

  const upperPole = orbitCase(spec, 0, POINTER_START.y + 10000);
  const lowerPole = orbitCase(spec, 0, POINTER_START.y - 10000);
  approximately(
    upperPole.flight.orbitElevation,
    upperPole.flight.orbitElevationLimit,
    "upper pole clamp",
  );
  approximately(
    lowerPole.flight.orbitElevation,
    -lowerPole.flight.orbitElevationLimit,
    "lower pole clamp",
  );
  trace.poleLimit = rounded(upperPole.flight.orbitElevationLimit);

  const retainedDisplacement = diagonal.flight.displacement.clone();
  step(diagonal.flight, diagonal.context);
  vectorApproximately(
    diagonal.flight.displacement,
    retainedDisplacement,
    "LMB release retains attained displacement",
  );
  assert.equal(diagonal.flight.orbiting, false, "LMB release stops orbit");
  trace.release = {
    displacement: vectorTrace(diagonal.flight.displacement),
    orbiting: diagonal.flight.orbiting,
  };

  const accelerationBlend = 1 - Math.exp(-7 * FRAME_DELTA);
  const forward = rmbCase(
    spec,
    POINTER_START.x,
    POINTER_START.y - 203,
  );
  const backward = rmbCase(
    spec,
    POINTER_START.x,
    POINTER_START.y + 203,
  );
  const leftStrafe = rmbCase(
    spec,
    POINTER_START.x - 203,
    POINTER_START.y,
  );
  const rightStrafe = rmbCase(
    spec,
    POINTER_START.x + 203,
    POINTER_START.y,
  );
  approximately(
    forward.flight.rmbThrustVelocity,
    spec.maxSpeed * accelerationBlend,
    "forward requested velocity and acceleration",
  );
  approximately(
    backward.flight.rmbThrustVelocity,
    -spec.maxSpeed * accelerationBlend,
    "backward requested velocity and acceleration",
  );
  approximately(
    leftStrafe.flight.rmbStrafeVelocity,
    spec.maxSpeed * accelerationBlend,
    "accepted mouse-left strafe sign",
  );
  approximately(
    rightStrafe.flight.rmbStrafeVelocity,
    -spec.maxSpeed * accelerationBlend,
    "accepted mouse-right strafe sign",
  );
  assert.ok(forward.flight.displacement.z < 0, "forward uses camera forward basis");
  assert.ok(backward.flight.displacement.z > 0, "backward reverses camera forward basis");
  assert.ok(leftStrafe.flight.displacement.x > 0, "left gesture keeps accepted right-basis sign");
  assert.ok(rightStrafe.flight.displacement.x < 0, "right gesture reverses accepted right-basis sign");
  trace.forwardVelocity = rounded(forward.flight.rmbThrustVelocity);
  trace.backwardVelocity = rounded(backward.flight.rmbThrustVelocity);
  trace.leftStrafeVelocity = rounded(leftStrafe.flight.rmbStrafeVelocity);
  trace.rightStrafeVelocity = rounded(rightStrafe.flight.rmbStrafeVelocity);
  trace.rmbActiveDuringTravel = forward.flight.hasRmbPointerStart;

  const insideDeadZone = rmbCase(
    spec,
    POINTER_START.x + 3,
    POINTER_START.y - 3,
  );
  approximately(insideDeadZone.flight.rmbThrustVelocity, 0, "thrust dead zone");
  approximately(insideDeadZone.flight.rmbStrafeVelocity, 0, "strafe dead zone");
  const firstPixelOutsideDeadZone = rmbCase(
    spec,
    POINTER_START.x - 4,
    POINTER_START.y - 4,
  );
  approximately(
    firstPixelOutsideDeadZone.flight.rmbThrustVelocity,
    0.08 * accelerationBlend,
    "thrust sensitivity immediately outside dead zone",
  );
  approximately(
    firstPixelOutsideDeadZone.flight.rmbStrafeVelocity,
    0.08 * accelerationBlend,
    "strafe sensitivity immediately outside dead zone",
  );
  trace.firstPixelOutsideDeadZoneVelocity = rounded(
    firstPixelOutsideDeadZone.flight.rmbThrustVelocity,
  );

  const diagonalRmb = rmbCase(
    spec,
    POINTER_START.x - 203,
    POINTER_START.y - 203,
  );
  approximately(
    diagonalRmb.flight.rmbThrustVelocity,
    forward.flight.rmbThrustVelocity,
    "diagonal keeps independent thrust component",
  );
  approximately(
    diagonalRmb.flight.rmbStrafeVelocity,
    leftStrafe.flight.rmbStrafeVelocity,
    "diagonal keeps independent strafe component",
  );
  approximately(
    diagonalRmb.flight.rmbMovement.length(),
    Math.hypot(
      diagonalRmb.flight.rmbThrustVelocity,
      diagonalRmb.flight.rmbStrafeVelocity,
    ) * FRAME_DELTA,
    "diagonal movement is not normalized",
  );
  trace.diagonalSpeedRatio = rounded(
    Math.hypot(
      diagonalRmb.flight.rmbThrustVelocity,
      diagonalRmb.flight.rmbStrafeVelocity,
    ) / diagonalRmb.flight.rmbThrustVelocity,
  );
  trace.diagonalRmbDisplacement = vectorTrace(diagonalRmb.flight.displacement);

  const braking = newCase(spec);
  step(braking.flight, braking.context, { rmb: true });
  for (let frame = 0; frame < 60; frame += 1) {
    step(braking.flight, braking.context, {
      pointerX: POINTER_START.x - 203,
      pointerY: POINTER_START.y - 203,
      rmb: true,
    });
  }
  const velocityAtRelease = braking.flight.rmbThrustVelocity;
  const expectedBrakeFrames = Math.ceil(
    Math.log(braking.flight.rmbStopEpsilon / velocityAtRelease)
      / (-braking.flight.rmbBraking * FRAME_DELTA),
  );
  let brakeFrames = 0;
  while (
    braking.flight.rmbThrustVelocity !== 0
    || braking.flight.rmbStrafeVelocity !== 0
  ) {
    const previousThrust = braking.flight.rmbThrustVelocity;
    step(braking.flight, braking.context);
    brakeFrames += 1;
    if (braking.flight.rmbThrustVelocity !== 0) {
      approximately(
        braking.flight.rmbThrustVelocity,
        previousThrust * Math.exp(-11 * FRAME_DELTA),
        "exponential braking",
      );
    }
    assert.ok(brakeFrames < 1000, "braking must reach exact zero");
  }
  assert.equal(brakeFrames, expectedBrakeFrames, "exact-zero braking frame");
  assert.equal(braking.flight.hasRmbPointerStart, false, "RMB release clears press state");
  trace.brakeFramesToZero = brakeFrames;

  const resync = newCase(spec);
  step(resync.flight, resync.context, { rmb: true });
  for (let frame = 0; frame < 30; frame += 1) {
    step(resync.flight, resync.context, {
      pointerY: POINTER_START.y - 120,
      rmb: true,
    });
  }
  const positionBeforeResync = resync.context.currentPosition.clone();
  const radiusBeforeResync = positionBeforeResync.distanceTo(PIVOT);
  step(resync.flight, resync.context, { lmb: true });
  vectorApproximately(
    resync.context.currentPosition,
    positionBeforeResync,
    "RMB-to-LMB resynchronization must not snap",
  );
  approximately(
    resync.flight.orbitRadius,
    radiusBeforeResync,
    "RMB-to-LMB resynchronizes current radius",
  );
  approximately(resync.flight.rmbThrustVelocity, 0, "LMB clears residual thrust");
  approximately(resync.flight.rmbStrafeVelocity, 0, "LMB clears residual strafe");
  trace.resynchronizedRadius = rounded(resync.flight.orbitRadius);

  const envelope = newCase(spec);
  step(envelope.flight, envelope.context, { delta: 1, rmb: true });
  for (let frame = 0; frame < 100; frame += 1) {
    step(envelope.flight, envelope.context, {
      delta: 1,
      pointerY: POINTER_START.y - 10000,
      rmb: true,
    });
  }
  approximately(
    envelope.flight.displacement.length(),
    spec.travelLimit,
    "travel-envelope clamp",
    1e-8,
  );
  trace.travelEnvelope = rounded(envelope.flight.displacement.length());

  envelope.flight.reset();
  vectorApproximately(envelope.flight.displacement, new THREE.Vector3(), "reset displacement");
  vectorApproximately(envelope.flight.nextDisplacement, new THREE.Vector3(), "reset next displacement");
  vectorApproximately(envelope.flight.orbitPosition, new THREE.Vector3(), "reset orbit position");
  vectorApproximately(envelope.flight.rmbMovement, new THREE.Vector3(), "reset RMB movement");
  approximately(envelope.flight.orbitRadius, 0, "reset orbit radius");
  approximately(envelope.flight.orbitAngle, 0, "reset orbit angle");
  approximately(envelope.flight.orbitElevation, 0, "reset orbit elevation");
  approximately(envelope.flight.rmbThrustVelocity, 0, "reset thrust velocity");
  approximately(envelope.flight.rmbStrafeVelocity, 0, "reset strafe velocity");
  assert.equal(envelope.flight.orbiting, false, "reset orbit state");
  assert.equal(envelope.flight.hasRmbPointerStart, false, "reset RMB state");
  assert.equal(envelope.flight.lastOrbitPointerY, null, "reset vertical pointer state");
  trace.resetCleared = true;

  return trace;
}

const specifications = [
  {
    name: "SpaceFlight",
    maxSpeed: 9,
    travelLimit: 40,
    createFlight: () => new SpaceFlight(makeRoot(1)),
  },
  {
    name: "GalaxyFlight",
    maxSpeed: 6,
    travelLimit: 35 * 1.5 * 4,
    createFlight: () => new GalaxyFlight(makeRoot(1.5)),
  },
];

for (const specification of specifications) {
  const trace = characterize(specification);
  console.log(`${specification.name}: PASS`);
  console.log(JSON.stringify(trace, null, 2));
}

console.log("Space/Galaxy Traveller characterization: PASS");
