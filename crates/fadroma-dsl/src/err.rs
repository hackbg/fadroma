use std::fmt::Display;

use quote::ToTokens;

use crate::{
    attr::MsgAttr,
    interface
};

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
    pub fn expected_interface_attrs(&mut self, el: impl ToTokens) {
        self.push_spanned(
            el,
            format!(
                "Expecting exactly one attribute of: {:?}",
                interface::SUPPORTED_ATTRS
            )
        );
    }

    #[inline]
    pub fn unsupported_interface_attr(
        &mut self,
        el: impl ToTokens,
        attr: MsgAttr
    ) {
        assert!(
            !interface::is_valid_attr(attr),
            "Tried to set an error for a supported interface attribute."
        );

        self.push_spanned(
            el,
            format!(
                "Interfaces cannot have the #[{}] attribute.",
                attr.as_str()
            )
        )
    }

    #[inline]
    pub fn duplicate_annotation(
        &mut self,
        el: impl ToTokens,
        attr: MsgAttr
    ) {
        self.push_spanned(
            el,
            format!("Only one method can be annotated as #[{}].", attr.as_str())
        )
    }

    #[inline]
    pub fn attr_no_effect(
        &mut self,
        el: impl ToTokens,
        attr: MsgAttr
    ) {
        self.push_spanned(
            el,
            format!(
                "#[{}] attribute has no effect when no entry point is defined. Either remove it or set an entry point for the contract.",
                attr.as_str()
            )
        );
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
