# CSV Schema: Sales Data Import

## Format

Standard comma-separated values (CSV) with a header row.

```
sku,quantity,saleDate,salePrice
```

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| `sku` | **Yes** | string | Must match an existing SKU in device inventory |
| `quantity` | **Yes** | integer ≥ 1 | Units sold in this record |
| `saleDate` | No | ISO 8601 date/datetime | Defaults to import time if omitted |
| `salePrice` | No | float ≥ 0 | Sale price per unit; defaults to 0 if omitted |

## Example

```csv
sku,quantity,saleDate,salePrice
DEVICE-001,5,2026-05-07T10:00:00Z,299.99
DEVICE-002,2,2026-05-07T11:30:00Z,199.99
COMP-BATT-001,10,2026-05-07,14.99
DEVICE-003,1,,399.00
```

## Validation Rules

1. **Header row required** — first row must contain column names (case-insensitive).
2. **`sku` must be non-empty** and exist in `deviceInventory`. Unknown SKUs are skipped with an error.
3. **`quantity` must be a positive integer** — non-numeric or zero values are skipped with an error.
4. **`saleDate`** — any ISO 8601 string is accepted (date only or full datetime). Blank uses the import timestamp.
5. **`salePrice`** — numeric float ≥ 0. Non-numeric values are ignored (treated as 0).
6. **Blank lines** are silently skipped.
7. **Partial imports are allowed** — valid rows are imported even if some rows have errors. The response includes both `recordsImported` and `errors`.

## Import Response

```json
{
  "recordsImported": 3,
  "errors": [
    { "row": 4, "message": "Unknown SKU: \"DEVICE-999\" — not found in device inventory" }
  ]
}
```

## How to Import

1. In the AIDA UI, navigate to **Data → Import Sales CSV**.
2. Click **Choose file** and select your `.csv` file.
3. Click **Import CSV**.
4. Review the import summary. Any skipped rows will be listed with their error messages.

## Notes

- The import endpoint is `POST /api/data/import` (requires authentication, Admin role recommended).
- Imported records are stored in `salesData` with `source: "manual_csv"`.
- Use this method when WooCommerce API credentials are not configured.
