"""Check x-positions of the PLAYER NAME column across all 48 pages."""
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox
from collections import defaultdict
import warnings, re
warnings.filterwarnings("ignore")

rows = defaultdict(list)
for page_num, page_layout in enumerate(extract_pages("squad-lists.pdf")):
    for element in page_layout:
        if isinstance(element, LTTextBox):
            text = element.get_text().strip()
            if text:
                y_bucket = round(element.y0 / 1.5) * 1.5
                rows[(page_num, y_bucket)].append((round(element.x0, 1), text))

dob_re = re.compile(r'^\d{2}/\d{2}/\d{4}$')

page_fullname_x = {}
for key in sorted(rows.keys(), key=lambda k: (k[0], -k[1])):
    page_num = key[0]
    if page_num in page_fullname_x:
        continue
    cells = sorted(rows[key])
    texts = [t for _, t in cells]
    has_dob = any(dob_re.match(t) for t in texts)
    has_pos = any(t in {'GK','DF','MF','FW'} for t in texts)
    if not has_dob or not has_pos:
        continue
    name_boxes = [(x, t) for x, t in cells
                  if 20 <= x <= 115 and t not in {'GK','DF','MF','FW'}
                  and not dob_re.match(t) and not t.isdigit()]
    page_fullname_x[page_num] = name_boxes

for pg in sorted(page_fullname_x):
    print(f"Page {pg+1:3d}: {page_fullname_x[pg]}")

