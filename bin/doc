#!/bin/sh
set -emu
OUTPUT="var/docs/deno"
deno doc -I --html --output="$OUTPUT" lib/index.ts
cp "$OUTPUT/all_symbols.html" "$OUTPUT/index.html"
echo '.namespaceItem{min-height:1.5rem !important;width:100%}' >> "$OUTPUT/styles.css"
echo '.namespaceItemContent{display: flex;flex-flow: row wrap}' >> "$OUTPUT/styles.css"
echo '.namespaceItemContent>a:first-child{min-width:10rem;margin-right:2rem}' >> "$OUTPUT/styles.css"
echo '.namespaceItemContentDoc{margin-top:0.25rem !important;width:100%}' >> "$OUTPUT/styles.css"
echo '.ddoc .section{display:block;max-width:95%}' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection{display:block;column-count:4;column-rule:1px solid #fff2;max-width:99%}' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection .namespaceItem { border-top: 1px dotted #fff2; border-bottom: 1px dotted #000; padding: 0.25rem 0.5rem; margin: 0 !important; }' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection .namespaceItem:hover { background:#ffffff08; }' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection .namespaceItem .namespaceItemContent .namespaceItemContentSubItems { width: 100% }' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection .namespaceItem .docNodeKindIcon {flex-direction: row;order:100}' >> "$OUTPUT/styles.css"
echo '.ddoc .namespaceSection .namespaceItem .docNodeKindIcon>*+* {margin-top:0}' >> "$OUTPUT/styles.css"
echo '#topnav { display: none }' >> "$OUTPUT/styles.css"
echo '#default h2 { display: none }' >> "$OUTPUT/styles.css"
