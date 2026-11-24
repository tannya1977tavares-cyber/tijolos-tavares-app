package br.com.tijolostavares.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Manda o PDF do orçamento direto na conversa do cliente no WhatsApp, já anexado. */
@CapacitorPlugin(name = "WhatsEnviar")
public class WhatsEnviarPlugin extends Plugin {
    @PluginMethod
    public void enviar(PluginCall call) {
        try {
            String b64 = call.getString("pdf", "");
            String nome = call.getString("nome", "orcamento.pdf").replaceAll("[^\\w.\\-]", "_");
            String tel = call.getString("tel", "");
            String texto = call.getString("texto", "");
            boolean soCompartilhar = Boolean.TRUE.equals(call.getBoolean("compartilhar", false));
            File pasta = new File(getContext().getCacheDir(), "pdfs");
            pasta.mkdirs();
            File arq = new File(pasta, nome);
            try (FileOutputStream out = new FileOutputStream(arq)) {
                out.write(Base64.decode(b64, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", arq);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/pdf");
            i.putExtra(Intent.EXTRA_STREAM, uri);
            if (!texto.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, texto);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            String d = tel.replaceAll("\\D", "");
            if (d.length() == 10 || d.length() == 11) d = "55" + d;
            boolean foi = false;
            if (!soCompartilhar) {
                // qual WhatsApp usar: o Business (com.whatsapp.w4b) ou o normal (com.whatsapp)
                String[] ordem = "business".equals(call.getString("app", "normal"))
                        ? new String[]{"com.whatsapp.w4b", "com.whatsapp"}
                        : new String[]{"com.whatsapp", "com.whatsapp.w4b"};
                for (String pkg : ordem) {
                    if (!instalado(pkg)) continue;
                    Intent w = new Intent(i);
                    w.setPackage(pkg);
                    if (d.length() >= 12) w.putExtra("jid", d + "@s.whatsapp.net");
                    try { getContext().startActivity(w); foi = true; break; } catch (Exception ignored) {}
                }
            }
            if (!foi) {
                Intent esc = Intent.createChooser(i, "Mandar o PDF");
                esc.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getContext().startActivity(esc);
            }
            JSObject r = new JSObject();
            r.put("whatsapp", foi);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Não deu pra mandar o PDF");
        }
    }

    private boolean instalado(String pkg) {
        try { getContext().getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
    }
}
