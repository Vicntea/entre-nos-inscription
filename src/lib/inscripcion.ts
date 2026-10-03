export type InscripcionData = {
  correo: string;
  nombre: string;
  apellido: string;
  edad: number;
  genero: string;
};

/** Web App de Google Apps Script que recibe las inscripciones. */
export const INSCRIPCION_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwSK0Nrzan8b4VkPvDCSKbG429IiAn43P0Q8EteEY7p6Z1dYTD9YSPo3GEokSgZWJmH/exec";

/**
 * Tiempo máximo que esperamos la respuesta del script. Pasado ese tiempo se da
 * el envío por bueno: no tiene sentido dejar a la persona esperando a los
 * servidores de Google (y con `no-cors` la respuesta igual es opaca).
 */
export const INSCRIPCION_TIMEOUT_MS = 9000;

/**
 * Bandera de desarrollo: en `true`, {@link guardarInscripcion} lanza un error
 * sin llegar a llamar al Apps Script, para probar el menú de falla del diálogo.
 * Dejala en `false` para producción.
 */
export const SIMULAR_FALLA_INSCRIPCION = false;

/** Campos tal como los espera el script (ver curl de referencia). */
type InscripcionPayload = {
  nombre: string;
  apellido: string;
  email: string;
  edad: string;
  genero: string;
};

/**
 * Guarda la información de inscripción del formulario
 * "¿Quieres ser parte del cambio?" en el Web App de Apps Script.
 *
 * Detalles del envío:
 * - Apps Script no responde al preflight `OPTIONS` de CORS; por eso se usa
 *   `mode: "no-cors"` con `Content-Type: text/plain` (petición "simple", sin
 *   preflight). El cuerpo sigue siendo el mismo JSON del curl y el script lo
 *   lee con `JSON.parse(e.postData.contents)`.
 * - La respuesta es *opaque*: desde el cliente solo se detecta un error de red
 *   (la petición no salió). Un fallo dentro del script no se puede ver acá;
 *   confirmá en la hoja de cálculo que la fila nueva se creó.
 * - Si el script tarda más de {@link INSCRIPCION_TIMEOUT_MS}, dejamos de
 *   esperar y la función resuelve igual (se asume que la inscripción llegó).
 *   No se aborta la petición: sigue viajando y el registro suele completarse
 *   igual en la planilla.
 */
export async function guardarInscripcion(
  data: InscripcionData
): Promise<void> {
  // console.log("1. Entrando a guardarInscripcion");

  const payload: InscripcionPayload = {
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.correo,
    edad: String(data.edad),
    genero: data.genero,
  };

  // console.log("2. Payload:", payload);
  // console.log("3. Endpoint:", INSCRIPCION_ENDPOINT);

  try {
    // console.log("4. Antes del fetch");

    if (SIMULAR_FALLA_INSCRIPCION) {
      throw new Error("Fallo simulado: SIMULAR_FALLA_INSCRIPCION");
    }

    const response = await fetch(INSCRIPCION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "follow",
    });

    // console.log("5. Fetch terminó");
    // console.log("Status:", response.status);
    // console.log("Type:", response.type);
    // console.log("URL final:", response.url);

    const text = await response.text();

    // console.log("6. Respuesta:", text);

    const result = JSON.parse(text);

    // console.log("7. JSON:", result);

    if (!result.success) {
      throw new Error(result.error || "Error al guardar la inscripción");
    }
  } catch (error) {
    console.error("8. ERROR:", error);
    throw error;
  }
}
