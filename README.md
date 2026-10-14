# Osakidetza OPE 23-24-25

Aplicación estática para GitHub Pages con tests de práctica a partir de las preguntas de `qa/temarios_merged.jsonl`.

## Datos de preguntas

`qa/temarios_merged.jsonl` contiene un objeto JSON por línea, ordenado por `tipo_temario` y `num_pregunta`: 200 preguntas de `comun`, 300 de `rt` y 300 de `tsid`. Cada objeto incluye el enunciado (`pregunta`), las opciones (`respuestas_posibles`), las respuestas aceptadas (`respuestas`) y las fuentes que consideran la pregunta impugnable (`impugnables`). Las claves de `respuestas` son las letras aceptadas; sus listas guardan las fuentes que respaldan cada letra. Solo se detallan fuentes cuando la pregunta es impugnable o las fuentes proponen respuestas diferentes; en los demás casos, la lista de la respuesta está vacía.

La aplicación carga este archivo directamente desde `app.js`, agrupa las preguntas por temario y usa las claves de `respuestas` para corregir el test. Tras enviarlo, muestra las fuentes de las respuestas y las impugnaciones. Si una pregunta no tiene ninguna respuesta aceptada, queda sin puntuar. No hay un paso de generación del JSONL en este repositorio.

El libro `respuestas ope osakidetza.xlsx` aporta, por hoja y número de pregunta, las letras aceptadas en `respuesta` y la atribución de fuentes e impugnaciones en `comentario`. Al reconciliarlo con el JSONL, se conservan los enunciados y las opciones existentes. La columna `NotebookLM` de la hoja `tsid` sirve como contraste y no se incorpora como fuente de respuesta.

## Vista local

```bash
python3 -m http.server 8000
```

Después abre `http://localhost:8000`.

## Publicación

Publica la raíz de este repositorio con GitHub Pages. La app no tiene paso de build ni dependencias externas.
