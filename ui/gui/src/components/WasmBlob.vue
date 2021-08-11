<template>
  <div class="WasmBlob Box">
    <header>
      <button class="BlobCodeId">#{{ id }}</button>
      <button class="BlobSchema icon-schema"></button>
      <div class="BlobTitle">
        <div><strong>{{ blob.name }}</strong><br>{{ blob.codeHash }}</div>
      </div>
      <button class="BlobClose icon-close" />
    </header>

    <content>
      <div class="InstancePicker">
        <img class="InstSearchIcon icon-filter" />
        <div class="InstSearch"><input type="text" placeholder="filter instances" /></div>
        <div class="InstList">instance list</div>
      </div>
      <div class="MethodPicker">
        <img class="InstIcon icon-instance" />
        <div class="InstTitle">
          <div><strong>inst label</strong><br>inst addr</div>
        </div>
        <div class="MethodList">instance method list</div>
      </div>
      <div class="Invocation">
        <div class="MethodIcon">q/tx</div>
        <div class="Method">method name</div>
        <div class="MethodArgs">method args</div>
        <button class="MethodRun icon-run" />
        <div class="MethodResult">method result</div>
      </div>
    </content>

    <div class="StatusBar"><strong>Helpful status bar&nbsp;</strong> instead of distracting tooltips</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "WasmBlob",
  props: ["id", "blob"],
});
</script>

<style scoped lang="scss">
.WasmBlob {
  background: black;
  color: white;
  display: grid;
  max-width: 100%;
  min-height: 24em;
  padding: 0;
  text-align: left;

  grid-gap: 0;
  grid-template-columns: 1fr;
  grid-template-rows: 3em 1fr 2em;
  grid-template-areas: "Header" "Content" "StatusBar";

  & > header {
    grid-area: Header;
    display: grid;
    grid-template-columns: 3em 3em 1fr 3em;
    grid-template-areas: "BlobCodeId BlobSchema BlobTitle BlobClose";
    .BlobCodeId {
      grid-area: BlobCodeId;
    }
    .BlobSchema {
      grid-area: BlobSchema;
      font-size: 1.5em;
    }
    .BlobTitle {
      grid-area: BlobTitle;
      color: white;
      text-shadow: 1px 1px 0 black;
      align-self: stretch;
      display: flex;
      align-items: center;
      flex-flow: row nowrap;
      margin: 0.25rem;
    }
    .BlobClose {
      grid-area: BlobClose;
      font-size: 1.5em;
    }
  }

  & > content {
    grid-area: Content;
    align-self: stretch;

    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas: "InstancePicker MethodPicker Invocation";
    .InstancePicker {
      grid-area: InstancePicker;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Items Items";
      .InstSearchIcon {
        grid-area: Icon;
        text-align: center;
        font-size: 1.5em;
        background: #222;
        align-self: stretch;
      }
      .InstSearch {
        grid-area: Title;
        background: #222;
        align-self: stretch;
      }
      .InstList {
        background: #333;
        grid-area: Items;
        align-self: stretch;
      }
    }
    .MethodPicker {
      grid-area: MethodPicker;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Items Items";
      .InstIcon {
        background: #333;
        grid-area: Icon;
        text-align: center;
        font-size: 1.5em;
        align-self: stretch;
      }
      .InstTitle {
        background: #333;
        color: white;
        text-shadow: 1px 1px 0 black;
        grid-area: Title;
        align-self: stretch;
        display: flex;
        align-items: center;
        flex-flow: row nowrap;
      }
      .MethodList {
        background: #444;
        grid-area: Items;
        align-self: stretch;
      }
    }
    .Invocation {
      grid-area: Invocation;
      align-self: stretch;
      display: grid;
      grid-template-rows: 3em 1fr 3em 1fr;
      grid-template-columns: 3em 1fr;
      grid-template-areas:
        "Icon Title"
        "Args Args"
        "Run Run "
        "Result Result";
      .MethodIcon {
        background: #444;
        grid-area: Icon;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.9em;
        border: 1px solid #888;
        align-self: stretch;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-flow: row nowrap;
      }
      .MethodName {
        background: #444;
        grid-area: Title;
      }
      .MethodArgs {
        background: #555;
        grid-area: Args;
        align-self: stretch;
      }
      .MethodRun {
        background: #464;
        grid-area: Run;
      }
      .MethodResult {
        background: #666;
        grid-area: Result;
        align-self: stretch;
      }
    }
  }
  .StatusBar {
    grid-area: StatusBar;
    color: white;
    align-self: stretch;
    display: flex;
    align-items: center;
    flex-flow: row nowrap;
    padding: 0 1em;
  }

  input {
    align-self: stretch;
    border-radius: 3em;
    margin: 0.5em 0;
  }

  button {
    align-self: stretch;
    cursor: pointer;
    font-weight: bold;
    background: none;
    border: 1px solid #888;
    opacity: 0.8;
    color: white;
    margin: 0.25rem;
    box-shadow: 1px 1px 1px #333;
    &:hover {
      border: 1px solid #fff;
    }
  }

  * {
    margin: 0;
    padding: 0;
    border: none;
    line-height: 1;
    font-size: 1em;
    align-self: center;
  }
  .Box.Header {
    min-height: 3em;
    grid-template-columns: 10% 80% 10%;
    grid-template-rows: 50% 50%;
  }
  .Box.Insts {
    text-align: left;
  }
  .CodeId {
    grid-column-start: 1;
    grid-column-end: 2;
    grid-row-start: 1;
    grid-row-end: 3;
    font-weight: bold;
  }
  .CodeName {
    grid-column-start: 2;
    grid-column-end: 3;
    grid-row-start: 1;
    grid-row-end: 2;
    margin-bottom: 0.5em;
  }
  .CodeHash {
    grid-column-start: 2;
    grid-column-end: 3;
    grid-row-start: 2;
    grid-row-end: 3;
    font-family: monospace;
    font-size: 0.9;
  }
  .Close {
    grid-column-start: 3;
    grid-column-end: 4;
    grid-row-start: 1;
    grid-row-end: 3;
    font-weight: bold;
  }
}
</style>
