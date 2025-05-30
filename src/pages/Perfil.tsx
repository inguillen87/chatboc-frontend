import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, UploadCloud } from "lucide-react";
import GooglePlacesAutocomplete from "react-google-autocomplete";
import TimePicker from "react-time-picker";

const DIAS_SEMANA = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
];

export default function Perfil() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map(() => ({ abre: "09:00", cierra: "18:00", cerrado: false }))
  );
  const [web, setWeb] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Manejo dirección autocompletado
  const handlePlace = (place) => {
    setDireccion(place.formatted_address || "");
    const addressComp = place.address_components || [];
    const provincia_ = addressComp.find(x => x.types.includes("administrative_area_level_1"));
    const ciudad_ = addressComp.find(x => x.types.includes("locality") || x.types.includes("administrative_area_level_2"));
    setProvincia(provincia_?.long_name || "");
    setCiudad(ciudad_?.long_name || "");
    setLat(place.geometry?.location?.lat() || "");
    setLng(place.geometry?.location?.lng() || "");
  };

  // Guardar cambios (acá llamás a tu backend)
  const handleGuardar = (e) => {
    e.preventDefault();
    setMensaje(""); setError("");
    // Validación simple
    if (!nombre || !telefono || !direccion || !web) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    // TODO: Llamar al backend (fetch o axios)
    setMensaje("Cambios guardados ✔️");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar, etc */}
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-3xl mx-auto px-4 space-y-10">
          <div className="flex gap-4 items-center mb-8">
            <Avatar className="w-16 h-16 cursor-pointer">
              <AvatarFallback>
                <span role="img" aria-label="avatar" className="text-2xl">👤</span>
              </AvatarFallback>
            </Avatar>
            <h1 className="text-3xl font-bold text-primary">Perfil de empresa</h1>
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={() => { localStorage.removeItem("user"); location.href = "/login"; }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuardar} className="space-y-6">
                <div>
                  <Label>Nombre empresa*</Label>
                  <Input value={nombre} onChange={e => setNombre(e.target.value)} required />
                </div>
                <div>
                  <Label>Teléfono*</Label>
                  <Input value={telefono} onChange={e => setTelefono(e.target.value)} required />
                </div>
                <div>
                  <Label>Dirección*</Label>
                  <GooglePlacesAutocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    selectProps={{
                      value: direccion ? { label: direccion, value: direccion } : null,
                      onChange: val => setDireccion(val.value),
                      placeholder: "Buscá la dirección exacta...",
                    }}
                    onPlaceSelected={handlePlace}
                    autocompletionRequest={{
                      componentRestrictions: { country: ["ar"] }
                    }}
                    style={{ width: "100%", minHeight: "42px" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ciudad</Label>
                    <Input value={ciudad} onChange={e => setCiudad(e.target.value)} />
                  </div>
                  <div>
                    <Label>Provincia</Label>
                    <Input value={provincia} onChange={e => setProvincia(e.target.value)} />
                  </div>
                </div>
                {/* Horarios PRO */}
                <div>
                  <Label>Horarios</Label>
                  <div className="border rounded-lg p-2 space-y-1 bg-muted">
                    {DIAS_SEMANA.map((dia, idx) => (
                      <div key={dia} className="flex items-center gap-2">
                        <span className="w-20">{dia}</span>
                        <input
                          type="checkbox"
                          checked={horarios[idx].cerrado}
                          onChange={e => {
                            const copia = [...horarios];
                            copia[idx].cerrado = e.target.checked;
                            setHorarios(copia);
                          }}
                        /> <span className="text-xs">Cerrado</span>
                        {!horarios[idx].cerrado && (
                          <>
                            <TimePicker
                              value={horarios[idx].abre}
                              onChange={val => {
                                const copia = [...horarios];
                                copia[idx].abre = val || "09:00";
                                setHorarios(copia);
                              }}
                              disableClock
                              clearIcon={null}
                              className="border rounded px-1 w-24"
                            />
                            <span>-</span>
                            <TimePicker
                              value={horarios[idx].cierra}
                              onChange={val => {
                                const copia = [...horarios];
                                copia[idx].cierra = val || "18:00";
                                setHorarios(copia);
                              }}
                              disableClock
                              clearIcon={null}
                              className="border rounded px-1 w-24"
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Web / Tienda*</Label>
                  <Input value={web} onChange={e => setWeb(e.target.value)} required />
                  {web && (
                    <a
                      href={web.startsWith("http") ? web : `https://${web}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-sm mt-1 block"
                    >
                      Ir a tienda: {web}
                    </a>
                  )}
                </div>
                <Button type="submit" className="w-full">Guardar cambios</Button>
                {mensaje && <p className="mt-2 text-green-600 text-center">{mensaje}</p>}
                {error && <p className="mt-2 text-red-600 text-center">{error}</p>}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
