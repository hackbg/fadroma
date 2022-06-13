const { Application, DefaultTheme, DefaultThemeRenderContext } = require("typedoc")

module.exports.load = function load (app: Application) {
    app.renderer.defineTheme("fadroma", FadromaTheme)
}

class FadromaTheme extends DefaultTheme {
  private _contextCache?: FadromaThemeContext
  override getRenderContext() {
      this._contextCache ||= new FadromaThemeContext(
          this._markedPlugin,
          this.application.options
      );
      return this._contextCache;
  }
}

class FadromaThemeContext extends DefaultThemeRenderContext {
}
