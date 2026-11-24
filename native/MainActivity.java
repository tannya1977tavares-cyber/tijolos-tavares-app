package br.com.tijolostavares.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgendaCelularPlugin.class);
        registerPlugin(AtualizadorPlugin.class);
        registerPlugin(WhatsEnviarPlugin.class);
        super.onCreate(savedInstanceState);
        abrirOrcamento(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        abrirOrcamento(intent);
    }

    /** Toque no widget da tela inicial: abre direto o orçamento rápido. */
    private void abrirOrcamento(Intent intent) {
        try {
            if (intent == null || getBridge() == null) return;
            String acao = intent.getStringExtra("abrir");
            if (acao == null) return;
            intent.removeExtra("abrir");
            final String url = getBridge().getLocalUrl() + "/rapido.html" + ("colar".equals(acao) ? "#colar" : "");
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
        } catch (Exception ignored) {
        }
    }
}
