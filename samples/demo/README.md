# Demo library: Tamsin Ridge Water Cooperative

Ten sample documents of a **fictional** water cooperative, used as the general edition's
demo library (`catsight-remote ingest` adds them to the demo organization). The
organization, people, places, companies and figures are invented; every page says so in
its footer.

| Document | Kind |
|---|---|
| TRWC Policy 2025-03 Travel and Per Diem | policy, text PDF |
| TRWC Policy 2023-07 Employee Leave | policy, text PDF |
| Board Resolution 2025-17 Pump Station 4 Award | scan |
| Contract TRWC-2025-041 Pump Station 4 | contract, text PDF |
| Board Minutes 2025-03-12 | scan |
| Incident Report IR-2025-004 Alder Street | scan, with tables |
| Memo 2024-22 Boil-Water Advisories | scan |
| Invoice HPM-0389 Halverson and Pike | scan, from the contractor |
| Notice Water Rate Adjustment July 2025 | notice, text PDF with a rate table |
| 2024 Annual Water Quality Report | report, text PDF with a results table |

The documents refer to each other (the resolution awards the contract, the invoice bills
against it, the minutes discuss the incident report, the rate notice explains the capital
program), so questions can span several of them, e.g. "How much has been billed so far on
the Pump Station 4 contract?" or "What happened after the Alder Street main break?".

Rebuild after editing `src/` (needs Google Chrome, Pillow, pypdfium2 and the `img2pdf`
command):

```bash
python3 samples/demo/build.py
```
