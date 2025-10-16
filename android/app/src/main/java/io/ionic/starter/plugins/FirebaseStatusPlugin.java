package io.ionic.starter.plugins;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.ionic.starter.FirebaseInitializer;

@CapacitorPlugin(name = "FirebaseStatus")
public class FirebaseStatusPlugin extends Plugin {
	private static final String TAG = "FirebaseStatusPlugin";

	@PluginMethod
	public void ensure(PluginCall call) {
		boolean ready = FirebaseInitializer.ensureInitialized(getContext());
		if (!ready) {
			Log.e(TAG, "Firebase initialization failed. Double-check google-services.json matches appId.");
		}
		JSObject result = new JSObject();
		result.put("ready", ready);
		call.resolve(result);
	}
}
