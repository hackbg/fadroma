pub fn to_pascal(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut capital = true;

    for c in s.chars() {
        if c == '_' {
            capital = true;
            continue;
        }

        if capital {
            c.to_uppercase()
                .into_iter()
                .for_each(|x| result.push(x));
        } else {
            result.push(c);
        }

        capital = false;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_pascal() {
        assert_eq!(to_pascal(&"to_pascal"), String::from("ToPascal"));
        assert_eq!(to_pascal(&"Very_Long_string"), String::from("VeryLongString"));
    }
}
