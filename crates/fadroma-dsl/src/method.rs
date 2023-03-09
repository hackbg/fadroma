use syn::{Signature, Path, Ident};

pub enum Method<'a> {
    Contract(ContractMethod<'a>),
    Interface(InterfaceMethod<'a>)
}

pub struct ContractMethod<'a> {
    pub sig: &'a Signature
}

pub struct InterfaceMethod<'a> {
    pub sig: &'a Signature,
    pub trait_: &'a Path
}

impl<'a> Method<'a> {
    #[inline]
    pub fn sig(&self) -> &Signature {
        match self {
            Method::Contract(x) => x.sig,
            Method::Interface(x) => x.sig
        }
    }
}

impl<'a> InterfaceMethod<'a> {
    #[inline]
    pub fn trait_name(&self) -> &Ident {
        &self.trait_.segments.last().unwrap().ident
    }
}
