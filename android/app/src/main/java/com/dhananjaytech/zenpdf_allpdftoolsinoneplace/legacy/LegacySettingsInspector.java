package com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy;

import androidx.datastore.preferences.PreferencesProto;
import com.google.gson.JsonObject;
import com.google.gson.Strictness;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Direct, bounded PreferenceMap reader. It never creates a DataStore or supplies defaults. */
public final class LegacySettingsInspector {
    static final long DEFAULT_MAX_BYTES = 1024L * 1024L;
    static final int DEFAULT_MAX_PREFERENCES = 1_000;
    static final int DEFAULT_MAX_JSON_NESTING = 32;
    private static final long MAX_SAFE_INTEGER = 9_007_199_254_740_991L;
    private static final Pattern TOOL = Pattern.compile("[A-Z][A-Z0-9_]*");
    private static final Pattern FORBIDDEN = Pattern.compile(
            "^(?:__proto__|prototype|constructor|storedFileName|fileName|filename|path|absolutePath|uri|url|providerAddress|bookmark|preferenceBytes|documentBytes|bytes|data|stream|items|children)$",
            Pattern.CASE_INSENSITIVE);
    private final File filesDir; private final long maxBytes; private final int maxPreferences, maxJsonNesting;
    public LegacySettingsInspector(File filesDir) { this(filesDir, DEFAULT_MAX_BYTES, DEFAULT_MAX_PREFERENCES, DEFAULT_MAX_JSON_NESTING); }
    LegacySettingsInspector(File filesDir,long maxBytes,int maxPreferences,int maxJsonNesting){this.filesDir=filesDir;this.maxBytes=maxBytes;this.maxPreferences=maxPreferences;this.maxJsonNesting=maxJsonNesting;}
    static JsonObject corruptSnapshot(){return empty("corrupt");}
    public JsonObject read() {
        File store=new File(filesDir,"datastore"), source=new File(store,"app_settings.preferences_pb");
        if(hasLinkAncestor(source)) return corruptSnapshot();
        if(!source.exists()) return empty("missing");
        if(!source.isFile()||!contained(store,source)) return corruptSnapshot();
        final byte[] raw; try { raw=readBounded(source,maxBytes); } catch(IOException e){return corruptSnapshot();}
        if(raw.length==0)return empty("blank");
        try {
            PreferencesProto.PreferenceMap map=PreferencesProto.PreferenceMap.parseFrom(raw);
            if(map.getPreferencesCount()>maxPreferences)return corruptSnapshot();
            JsonObject values=new JsonObject();int invalid=0;
            for(Map.Entry<String,PreferencesProto.Value> entry:map.getPreferencesMap().entrySet()){
                if(!known(entry.getKey()))continue;
                try { add(values,entry.getKey(),entry.getValue()); } catch(IOException bad){invalid++;}
            }
            JsonObject out=new JsonObject();out.addProperty("health",invalid==0?"ok":"partial_invalid");out.addProperty("invalidValueCount",invalid);out.add("values",values);return out;
        }catch(Exception e){return corruptSnapshot();}
    }
    private static boolean known(String k){return Set.of("theme_mode","app_font_option","onboarding_completed","tool_usage_memory","savings_tally","tool_option_memory","last_privacy_line_index").contains(k);}
    private void add(JsonObject out,String key,PreferencesProto.Value value)throws IOException {
        if(key.equals("onboarding_completed")){if(value.getValueCase()!=PreferencesProto.Value.ValueCase.BOOLEAN)throw new IOException();out.addProperty(key,value.getBoolean());return;}
        if(key.equals("last_privacy_line_index")){if(value.getValueCase()!=PreferencesProto.Value.ValueCase.INTEGER||value.getInteger()<0)throw new IOException();out.addProperty(key,value.getInteger());return;}
        if(value.getValueCase()!=PreferencesProto.Value.ValueCase.STRING)throw new IOException();String text=value.getString();if(text.indexOf('\0')>=0)throw new IOException();
        if(key.equals("theme_mode")&&!Set.of("SYSTEM","DYNAMIC","LIGHT","DARK").contains(text))throw new IOException();
        if(key.equals("app_font_option")&&!TOOL.matcher(text).matches())throw new IOException();
        if(key.equals("tool_usage_memory"))usage(text);if(key.equals("savings_tally"))savings(text);if(key.equals("tool_option_memory"))options(text);
        out.addProperty(key,text);
    }
    private void usage(String value)throws IOException{try(JsonReader r=reader(value)){Set<String>s=objectStart(r);boolean runs=false,follow=false;while(r.hasNext()){String n=r.nextName();if(!s.add(n))throw new IOException();if(n.equals("runs")){counts(r);runs=true;}else if(n.equals("followUps")){followUps(r);follow=true;}else throw new IOException();}r.endObject();complete(r);if(!runs||!follow)throw new IOException();}}
    private void savings(String value)throws IOException{try(JsonReader r=reader(value)){Set<String>s=objectStart(r);boolean b=false,f=false;while(r.hasNext()){String n=r.nextName();if(!s.add(n))throw new IOException();if(n.equals("bytesSaved")){nonNegative(r);b=true;}else if(n.equals("filesReduced")){nonNegative(r);f=true;}else throw new IOException();}r.endObject();complete(r);if(!b||!f)throw new IOException();}}
    private void options(String value)throws IOException{try(JsonReader r=reader(value)){Set<String> seen=objectStart(r);while(r.hasNext()){String key=r.nextName();if(!seen.add(key)||forbidden(key)||!TOOL.matcher(key).matches()||r.peek()!=JsonToken.STRING)throw new IOException();if(r.nextString().indexOf('\0')>=0)throw new IOException();}r.endObject();complete(r);}}
    private void counts(JsonReader r)throws IOException{Set<String> seen=objectStart(r);while(r.hasNext()){String key=r.nextName();if(!seen.add(key)||forbidden(key)||!TOOL.matcher(key).matches())throw new IOException();positive(r);}r.endObject();}
    private void followUps(JsonReader r)throws IOException{Set<String> seen=objectStart(r);while(r.hasNext()){String key=r.nextName();if(!seen.add(key)||forbidden(key)||!TOOL.matcher(key).matches())throw new IOException();counts(r);}r.endObject();}
    private static Set<String> objectStart(JsonReader r)throws IOException{if(r.peek()!=JsonToken.BEGIN_OBJECT)throw new IOException();r.beginObject();return new HashSet<>();}
    private static boolean forbidden(String key){return FORBIDDEN.matcher(key).matches();}
    private static void positive(JsonReader r)throws IOException{long n=nonNegativeValue(r);if(n<1)throw new IOException();}
    private static void nonNegative(JsonReader r)throws IOException{nonNegativeValue(r);}
    private static long nonNegativeValue(JsonReader r)throws IOException{if(r.peek()!=JsonToken.NUMBER)throw new IOException();String s=r.nextString();if(!s.matches("0|[1-9][0-9]*"))throw new IOException();try{long n=Long.parseLong(s);if(n<0||n>MAX_SAFE_INTEGER)throw new IOException();return n;}catch(NumberFormatException e){throw new IOException();}}
    private JsonReader reader(String value){JsonReader r=new JsonReader(new InputStreamReader(new ByteArrayInputStream(value.getBytes(StandardCharsets.UTF_8)),StandardCharsets.UTF_8));r.setStrictness(Strictness.STRICT);r.setNestingLimit(maxJsonNesting);return r;}
    private static void complete(JsonReader r)throws IOException{if(r.peek()!=JsonToken.END_DOCUMENT)throw new IOException();}
    private static JsonObject empty(String health){JsonObject o=new JsonObject();o.addProperty("health",health);o.addProperty("invalidValueCount",0);o.add("values",new JsonObject());return o;}
    private static byte[] readBounded(File source,long limit)throws IOException{try(FileInputStream in=new FileInputStream(source);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[]b=new byte[8192];long n=0;for(int r;(r=in.read(b))!=-1;){n+=r;if(n>limit)throw new IOException();out.write(b,0,r);}return out.toByteArray();}}
    private boolean hasLinkAncestor(File file){File p=file;while(p!=null){if(link(p))return true;if(p.equals(filesDir))return false;p=p.getParentFile();}return true;}
    private static boolean contained(File parent,File child){try{return child.getCanonicalFile().getParentFile().equals(parent.getCanonicalFile());}catch(IOException e){return false;}}
    private static boolean link(File f){try{return Files.isSymbolicLink(f.toPath());}catch(Exception e){return true;}}
}
