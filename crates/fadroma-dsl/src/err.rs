use std::fmt::Display;

use quote::ToTokens;

pub type CompileErrors = Vec<syn::Error>;

#[derive(Default, Debug)]
pub struct ErrorSink(Vec<syn::Error>);

impl ErrorSink {
    #[inline]
    pub fn push(
        &mut self,
        span: proc_macro2::Span,
        msg: impl Display
    ) {
        self.0.push(syn::Error::new(span, msg));
    }
    
    #[inline]
    pub fn push_spanned(
        &mut self,
        el: impl ToTokens,
        msg: impl Display
    ) {
        self.0.push(syn::Error::new_spanned(el, msg)); 
    }

    #[inline]
    pub fn push_err(&mut self, err: syn::Error) {
        self.0.push(err);
    }

    #[inline]
    pub fn check(self) -> Result<(), CompileErrors> {
        if self.0.is_empty() {
            Ok(())
        } else {
            Err(self.0)
        }
    }
}
