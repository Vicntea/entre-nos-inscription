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
export const INSCRIPCION_TIMEOUT_MS = 3000;

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
export async function guardarInscripcion(data: InscripcionData): Promise<void> {
  const payload: InscripcionPayload = {
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.correo,
    edad: String(data.edad),
    genero: data.genero,
  };

  const request = fetch(INSCRIPCION_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store",
    redirect: "follow",
  });

  // La petición queda en vuelo aunque dejemos de esperarla: esto evita que una
  // falla posterior (después del timeout) quede como rechazo sin manejar.
  request.catch(() => {});

  await Promise.race([
    request,
    new Promise<void>((resolve) => {
      setTimeout(resolve, INSCRIPCION_TIMEOUT_MS);
    }),
  ]);
}
