# Intelimat Data Inventory — What We Actually Have

## Example: Z1 ZAPATA CORRIDA 2 ESCARPIOS

### 1. The Intelimat Row (intelimats_catalog)

| Column | Value |
|--------|-------|
| id | 19859511-b444-4f10-901e-7f49d6a6cd55 |
| clave_neodata | 03 02 CIMENTACION ZAPATAS |
| nombre | Z1 ZAPATA CORRIDA 2 ESCARPIOS |
| descripcion | NULL |
| parametros | NULL **← THE FORMULA. EMPTY.** |
| conceptos_rel | NULL **← THE GENERATED CONCEPTOS. EMPTY.** |
| implementado | false |
| notas | "Phase 3 - not implemented" |

**That's it.** The actual parametric formula was never in the DB we extracted.

---

### 2. What We DO Have: The Building-Block Conceptos

For a zapata corrida, these conceptos already exist in our DB with full matrices and PU:

#### a) "Cimiento de concreto..." (25 variants by size)
Each is a pre-defined complete element, e.g.:

```
clave_neodata: 10401-571
nombre: Cimiento de concreto F'c=250 kg/cm2, zapata corrida de 60cm ancho x 12cm peralte
unidad: M   (linear meter)
```

This concepto has a matrix of 4-5 insumos per variant with quantities PER LINEAR METER:

| Insumo | Cantidad | Unidad | Precio | Importe |
|--------|----------|--------|--------|---------|
| Acero refuerzo No.3 (3/8") | 9.94 | KG | $31.57 | $313.81 |
| Acero refuerzo No.4 (1/2") | 4.00 | KG | $30.17 | $120.68 |
| Cimbra en zapatas | 1.20 | M2 | $279.89 | $335.87 |
| Concreto F'c=250 | 0.144 | M3 | $4,258.27 | $613.19 |

**PU = sum of importes = $1,383.55 / ml** (varies by region/tier)

#### b) Other Building-Block Conceptos Under Cimentaciones

| Subpartida | # Conceptos | Description |
|---|---|---|
| Excavaciones a mano | 26 | Excavación para cimentación (m³) |
| Excavaciones a máquina | 21 | Excavación mecánica (m³) |
| Plantillas | 16 | Plantilla de concreto pobre (m²) |
| Cimientos de concreto armado | 25 | Zapata corrida pre-definida (ml) |
| Concretos | 26 | Concreto F'c=250 (m³) — standalone |
| Acero de refuerzo | 40 | Acero No.3-8 en cimentación (kg) |
| Cimbras | 17 | Cimbra en zapatas (m²) |
| Rellenos | 12 | Relleno compactado (m³) |

These are the **building blocks** the intelimat formula would reference.

---

### 3. What a Complete Intelimat Formula WOULD Look Like

This is what's MISSING — we need to author this. A formula for Z1 would be:

```python
INTELIMAT_Z1 = {
    "code": "Z1",
    "name": "ZAPATA CORRIDA 2 ESCARPIOS",
    "category": "03 02 CIMENTACION ZAPATAS",
    "parameters": {
        "ancho_inferior":  {"label": "Ancho inferior (m)",  "default": 1.00},
        "ancho_superior":  {"label": "Ancho superior (m)",  "default": 0.20},
        "altura_base":     {"label": "Altura base (m)",      "default": 0.20},
        "altura_escarpe":  {"label": "Altura escarpe (m)",   "default": 0.60},
        "f_c":             {"label": "F'c (kg/cm²)",        "default": 250, "options": [200, 250, 300]},
        "recubrimiento":   {"label": "Recubrimiento (cm)",  "default": 5},
    },
    "generated_conceptos": [
        {
            "concepto_key": "10401-XXX",  # Excavación
            "quantity_formula": "(ancho_inferior + 0.60) * (altura_base + altura_escarpe) * longitud"
        },
        {
            "concepto_key": "10401-YYY",  # Plantilla
            "quantity_formula": "ancho_inferior * longitud"
        },
        {
            "concepto_key": "10401-571",  # Concreto zapata (we'd use this exact concepto)
            "quantity_formula": "ancho_inferior * altura_base + ((ancho_inferior + ancho_superior) / 2) * altura_escarpe"
            # This is the MISSING formula — we need to define it
        },
        {
            "concepto_key": "10401-ZZZ",  # Acero refuerzo
            "quantity_formula": "... engineering calculation based on f_c, dimensions, recubrimiento ..."
        },
        {
            "concepto_key": "10401-WWW",  # Cimbra
            "quantity_formula": "2 * (altura_base + altura_escarpe) * longitud"
        },
        {
            "concepto_key": "10401-VVV",  # Relleno
            "quantity_formula": "(ancho_inferior + 0.60) * (altura_base + altura_escarpe) * longitud * 0.5"
        },
    ]
}
```

### 4. Summary: What Exists vs What's Missing

| What | Exists? | Details |
|---|---|---|
| Intelimat catalog (229 names) | ✅ | id, name, category, empty formulas |
| Building-block conceptos | ✅ | 20K conceptos with full descriptions, units |
| Concepto matrices (insumo qties) | ✅ | 105K rows linking conceptos → insumos |
| Insumos catalog | ✅ | 18K materials, labor, equipment |
| Prices per insumo per region | ✅ | ~75K prices across 11 regions |
| Partida hierarchy | ✅ | Links intelimat categories to concepto categories |
| **Parametric formulas** | **❌** | **The rules that say "given dimensions, generate N units of concepto X"** |

The formulas were never in the ConstruBase SQL server data we extracted — the `Cadena` column was empty for all 229 intelimats. They were likely in the ConstruBase application code (compiled or hardcoded). For Phase 3, we'd need to **author these formulas ourselves** using construction engineering knowledge.
