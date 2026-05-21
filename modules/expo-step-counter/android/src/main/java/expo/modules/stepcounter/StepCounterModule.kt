package expo.modules.stepcounter

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Custom Expo module exposing Android's Sensor.TYPE_STEP_COUNTER for
// Stridekeep's HC-less step-tracking fallback. Sidesteps expo-sensors'
// Pedometer which resets its baseline on every new listener registration
// (see PedometerModule.kt's `listenerDecorator = { stepsAtTheBeginning = null }`)
// — that prevents us from computing deltas across app sessions, which
// IS the whole point of a sensor fallback to HC.
//
// What we need that Expo's Pedometer doesn't give us: the raw cumulative
// step count since device boot. The hardware sensor keeps this value
// across listener registrations on essentially every modern Android phone
// (this is how Google Fit / Samsung Health / Mi Health all worked before
// Health Connect became the unified layer). We register a one-shot
// listener, capture the first event's cumulative value, unregister, and
// return. Caller (src/native/stepCounter.ts) persists "last known
// cumulative" + "today's count" in AsyncStorage and computes deltas.
//
// Permissions: ACTIVITY_RECOGNITION is runtime-required on API 29+ (Android 10+).
// Below that, the sensor is accessible without a runtime grant — the
// PermissionsManager call with no args still resolves correctly so we
// don't fork the permission path by SDK level beyond the actual API
// guard.
class StepCounterModule : Module() {
  // 3 seconds is enough for the OS to deliver the latest known step count
  // on registration. Android delivers the cached value to a new listener
  // within milliseconds on Pixel/Samsung/most modern phones; the timeout
  // is a safety net for sensors that delay delivery (rare).
  private val SENSOR_READ_TIMEOUT_MS = 3000L

  override fun definition() = ModuleDefinition {
    Name("ExpoStepCounter")

    // Returns true iff the device exposes a step counter sensor. This
    // is a HARDWARE check — every modern Android phone (~98% of the
    // install base) has one, but devices without one (pre-Android 4.4
    // or some old budget hardware) will return false. The caller then
    // falls back further (typically: show the unavailable gate).
    AsyncFunction("isAvailableAsync") { promise: Promise ->
      val sensorManager = appContext.reactContext
        ?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      val sensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      promise.resolve(sensor != null)
    }

    // Resolves with the hardware sensor's cumulative step count since
    // last device reboot. This is the raw value we need to compute
    // session deltas in JS. Lifecycle:
    //   1. Register a SensorEventListener with FASTEST delivery
    //   2. On first onSensorChanged event, capture the cumulative,
    //      unregister, resolve the promise
    //   3. If no event by SENSOR_READ_TIMEOUT_MS, reject with TIMEOUT
    //      (the JS caller skips this update and tries again next foreground)
    AsyncFunction("getCumulativeStepsAsync") { promise: Promise ->
      val sensorManager = appContext.reactContext
        ?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      if (sensorManager == null) {
        promise.reject(
          CodedException("NO_SENSOR_MANAGER", "SensorManager unavailable", null)
        )
        return@AsyncFunction
      }
      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (sensor == null) {
        promise.reject(
          CodedException("NO_STEP_SENSOR", "Device has no step counter sensor", null)
        )
        return@AsyncFunction
      }

      val handler = Handler(Looper.getMainLooper())
      var resolved = false

      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          if (resolved) return
          resolved = true
          sensorManager.unregisterListener(this)
          handler.removeCallbacksAndMessages(null)
          // event.values[0] is documented as the cumulative step count
          // since boot. It comes through as a float because the sensor
          // framework is float-typed, but the value is always integral.
          promise.resolve(event.values[0].toLong())
        }
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
      }

      val registered = sensorManager.registerListener(
        listener, sensor, SensorManager.SENSOR_DELAY_FASTEST
      )
      if (!registered) {
        promise.reject(
          CodedException(
            "REGISTER_FAILED",
            "Could not register step counter listener",
            null
          )
        )
        return@AsyncFunction
      }

      handler.postDelayed({
        if (!resolved) {
          resolved = true
          sensorManager.unregisterListener(listener)
          promise.reject(
            CodedException(
              "TIMEOUT",
              "Step counter did not deliver a value within ${SENSOR_READ_TIMEOUT_MS}ms",
              null
            )
          )
        }
      }, SENSOR_READ_TIMEOUT_MS)
    }

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Permissions.getPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.ACTIVITY_RECOGNITION
        )
      } else {
        // Pre-API 29 (Android 9 and below): no runtime permission needed.
        // Permissions manager still needs a non-empty call so it returns
        // a granted=true response with sensible defaults.
        Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise)
      }
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.ACTIVITY_RECOGNITION
        )
      } else {
        Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise)
      }
    }
  }
}
