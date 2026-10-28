package br.com.tijolostavares.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Coloca as cargas no calendário do próprio celular (evento de dia inteiro). */
@CapacitorPlugin(
    name = "AgendaCelular",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }, alias = "calendar")
    }
)
public class AgendaCelularPlugin extends Plugin {

    private boolean liberado() {
        return getPermissionState("calendar") == PermissionState.GRANTED;
    }

    private void responder(PluginCall call, boolean ok) {
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void temPermissao(PluginCall call) {
        responder(call, liberado());
    }

    @PluginMethod
    public void pedirPermissao(PluginCall call) {
        if (liberado()) {
            responder(call, true);
        } else {
            requestPermissionForAlias("calendar", call, "depoisDaPermissao");
        }
    }

    @PermissionCallback
    private void depoisDaPermissao(PluginCall call) {
        responder(call, liberado());
    }

    private long calendarioId() {
        ContentResolver cr = getContext().getContentResolver();
        String[] proj = { CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY };
        String sel = CalendarContract.Calendars.VISIBLE + "=1 AND " + CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR;
        long primeiro = -1;
        try (Cursor c = cr.query(CalendarContract.Calendars.CONTENT_URI, proj, sel, null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    long id = c.getLong(0);
                    if (primeiro < 0) primeiro = id;
                    if (c.getInt(1) == 1) return id;
                }
            }
        }
        return primeiro;
    }

    @PluginMethod
    public void salvar(PluginCall call) {
        if (!liberado()) { call.reject("sem permissão", "SEM_PERMISSAO"); return; }
        String titulo = call.getString("titulo", "Entrega");
        String descricao = call.getString("descricao", "");
        String data = call.getString("data");
        String eventoId = call.getString("eventoId", "");
        if (data == null) { call.reject("data faltando"); return; }
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(data);
            long inicio = d.getTime();
            long fim = inicio + 24L * 60 * 60 * 1000;

            ContentValues v = new ContentValues();
            v.put(CalendarContract.Events.TITLE, titulo);
            v.put(CalendarContract.Events.DESCRIPTION, descricao);
            v.put(CalendarContract.Events.DTSTART, inicio);
            v.put(CalendarContract.Events.DTEND, fim);
            v.put(CalendarContract.Events.ALL_DAY, 1);
            v.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");

            ContentResolver cr = getContext().getContentResolver();
            long id = -1;
            if (eventoId != null && !eventoId.isEmpty()) {
                long antigo = Long.parseLong(eventoId);
                int n = cr.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, antigo), v, null, null);
                if (n > 0) id = antigo;
            }
            if (id < 0) {
                long cal = calendarioId();
                if (cal < 0) { call.reject("nenhum calendário no celular", "SEM_CALENDARIO"); return; }
                v.put(CalendarContract.Events.CALENDAR_ID, cal);
                Uri u = cr.insert(CalendarContract.Events.CONTENT_URI, v);
                if (u == null) { call.reject("não salvou"); return; }
                id = ContentUris.parseId(u);
            }
            JSObject r = new JSObject();
            r.put("eventoId", String.valueOf(id));
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void apagar(PluginCall call) {
        if (!liberado()) { call.reject("sem permissão", "SEM_PERMISSAO"); return; }
        String eventoId = call.getString("eventoId", "");
        try {
            if (eventoId != null && !eventoId.isEmpty()) {
                getContext().getContentResolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(eventoId)), null, null);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
