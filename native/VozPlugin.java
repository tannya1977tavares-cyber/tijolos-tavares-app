package br.com.tijolostavares.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;
import java.util.List;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Gravar pedido por voz, igual ao áudio do WhatsApp: segura o microfone, fala, solta.
 * Enquanto o dedo está no botão, o reconhecimento do Android fica ouvindo e vai juntando o texto
 * (se ele parar numa pausa, volta a ouvir sozinho). Ao soltar, devolve tudo que entendeu.
 */
@CapacitorPlugin(name = "Voz", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microfone") })
public class VozPlugin extends Plugin {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private SpeechRecognizer rec;
    private boolean segurando = false;
    private final StringBuilder texto = new StringBuilder();
    private String parcial = "";
    private PluginCall chamadaParar;
    private int tentativas = 0;

    /** Abre a tela de permissão do microfone (se ainda não tiver). */
    @PluginMethod
    public void permissao(PluginCall call) {
        if (getPermissionState("microfone") == PermissionState.GRANTED) {
            call.resolve(new JSObject().put("ok", true));
        } else {
            requestPermissionForAlias("microfone", call, "depoisDaPermissao");
        }
    }

    @PermissionCallback
    private void depoisDaPermissao(PluginCall call) {
        call.resolve(new JSObject().put("ok", getPermissionState("microfone") == PermissionState.GRANTED));
    }

    /** Começa a ouvir (dedo encostou no microfone). */
    @PluginMethod
    public void iniciar(PluginCall call) {
        if (getPermissionState("microfone") != PermissionState.GRANTED) {
            call.reject("sem-permissao");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("sem-reconhecimento");
            return;
        }
        ui.post(() -> {
            try {
                texto.setLength(0);
                parcial = "";
                tentativas = 0;
                segurando = true;
                criar();
                ouvir();
                call.resolve(new JSObject().put("ok", true));
            } catch (Exception e) {
                call.reject("erro-iniciar: " + e.getMessage());
            }
        });
    }

    /** Para de ouvir (dedo saiu do microfone) e devolve o texto. */
    @PluginMethod
    public void parar(PluginCall call) {
        ui.post(() -> {
            segurando = false;
            chamadaParar = call;
            try {
                if (rec != null) rec.stopListening();
            } catch (Exception ignored) {
            }
            // se o Android não mandar o resultado final em 2,5 s, devolve o que já tem
            ui.postDelayed(this::entregar, 2500);
        });
    }

    private void entregar() {
        if (chamadaParar == null) return;
        if (!parcial.isEmpty()) {
            juntar(parcial);
            parcial = "";
        }
        PluginCall c = chamadaParar;
        chamadaParar = null;
        c.resolve(new JSObject().put("texto", texto.toString().trim()));
        destruir();
    }

    private void juntar(String s) {
        if (s == null || s.trim().isEmpty()) return;
        if (texto.length() > 0) texto.append(' ');
        texto.append(s.trim());
    }

    private void criar() {
        destruir();
        ComponentName google = servicoGoogle();
        rec = google != null ? SpeechRecognizer.createSpeechRecognizer(getContext(), google) : SpeechRecognizer.createSpeechRecognizer(getContext());
        rec.setRecognitionListener(new Ouvinte());
    }

    /** Usa o reconhecimento de voz do Google quando existir (alguns Samsung vêm com outro padrão). */
    private ComponentName servicoGoogle() {
        try {
            List<ResolveInfo> lista = getContext().getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
            for (ResolveInfo r : lista) {
                if (r.serviceInfo != null && r.serviceInfo.packageName.startsWith("com.google")) {
                    return new ComponentName(r.serviceInfo.packageName, r.serviceInfo.name);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void ouvir() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 8000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 8000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 60000L);
        rec.startListening(i);
    }

    private void destruir() {
        try {
            if (rec != null) {
                rec.cancel();
                rec.destroy();
            }
        } catch (Exception ignored) {
        }
        rec = null;
    }

    private void avisar(String parte) {
        String t = (texto.toString() + " " + (parte == null ? "" : parte)).trim();
        notifyListeners("parcial", new JSObject().put("texto", t));
    }

    private class Ouvinte implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle b) { notifyListeners("estado", new JSObject().put("estado", "ouvindo")); }
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float v) { notifyListeners("volume", new JSObject().put("v", v)); }
        @Override public void onBufferReceived(byte[] b) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int t, Bundle b) {}

        @Override
        public void onPartialResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (m != null && !m.isEmpty() && m.get(0) != null && !m.get(0).isEmpty()) {
                parcial = m.get(0);
                tentativas = 0;
                avisar(parcial);
            }
        }

        @Override
        public void onResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            String fim = (m != null && !m.isEmpty()) ? m.get(0) : parcial;
            parcial = "";
            juntar(fim);
            avisar("");
            if (segurando) {
                ui.postDelayed(() -> { if (segurando) { try { criar(); ouvir(); } catch (Exception ignored) {} } }, 150);
            } else {
                entregar();
            }
        }

        @Override
        public void onError(int erro) {
            if (!parcial.isEmpty()) { juntar(parcial); parcial = ""; }
            // pausa sem fala ou nada entendido: se o dedo ainda está no botão, volta a ouvir
            boolean pausa = erro == SpeechRecognizer.ERROR_NO_MATCH || erro == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
            if (segurando && (pausa || erro == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || erro == SpeechRecognizer.ERROR_CLIENT) && ++tentativas <= 8) {
                ui.postDelayed(() -> { if (segurando) { try { criar(); ouvir(); } catch (Exception ignored) {} } }, 250);
                return;
            }
            if (segurando) {
                notifyListeners("erro", new JSObject().put("codigo", erro).put("msg", nomeErro(erro)));
                segurando = false;
            }
            entregar();
        }
    }

    private static String nomeErro(int e) {
        switch (e) {
            case SpeechRecognizer.ERROR_AUDIO: return "Erro no áudio do microfone";
            case SpeechRecognizer.ERROR_CLIENT: return "Erro no app de voz";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Sem permissão do microfone";
            case SpeechRecognizer.ERROR_NETWORK: return "Sem internet pro reconhecimento de voz";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Internet lenta pro reconhecimento de voz";
            case SpeechRecognizer.ERROR_NO_MATCH: return "Não entendi o que foi falado";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Reconhecimento de voz ocupado";
            case SpeechRecognizer.ERROR_SERVER: return "Erro no serviço de voz do Google";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "Não ouvi nada";
            default: return "Erro de voz (código " + e + ")";
        }
    }
}
