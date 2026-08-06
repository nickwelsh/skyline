# Vendored npm licenses

These immutable texts cover direct runtime packages whose published archives omit a license file.
Package names, versions, SPDX declarations, repositories, authors, and `gitHead` values were verified
against the installed package metadata and npm registry metadata on 2026-08-06.

| Packages | Vendored text | Authoritative source |
| --- | --- | --- |
| `@heroicons/react` 2.0.13 | `heroicons-MIT.txt` | [`tailwindlabs/heroicons` `1511059c0584aa0d2690cb89c01b183c4ae011d7`](https://github.com/tailwindlabs/heroicons/blob/1511059c0584aa0d2690cb89c01b183c4ae011d7/LICENSE) |
| `@radix-ui/react-dialog` 1.0.3, `@radix-ui/react-popover` 1.0.5, `@radix-ui/react-slider` 1.1.2, `@radix-ui/react-switch` 1.0.3, `@radix-ui/react-tooltip` 1.0.5 | `radix-ui-MIT.txt` | [`radix-ui/primitives` `f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae`](https://github.com/radix-ui/primitives/blob/f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae/LICENSE) |
| `assert-never` 1.2.1 | `assert-never-MIT.txt` | [`aikoven/assert-never` `d55b0887a4c8336fe308c3d155a8d838efe0e9f0`](https://github.com/aikoven/assert-never/blob/d55b0887a4c8336fe308c3d155a8d838efe0e9f0/LICENSE) |
| `non.geist` 1.0.2 | `non.geist-MIT.txt` | Package metadata at [`contigen/non.geist` `92bea27a67d974c0d0cbd0b6a66920822f9ebc2d`](https://github.com/contigen/non.geist/blob/92bea27a67d974c0d0cbd0b6a66920822f9ebc2d/package.json) declares MIT and author `contigen`; the immutable commit identifies Muhammed Tijani. The repository does not contain a separate MIT text, so the standard MIT grant is reproduced with that attribution. |

`assert-never`'s release commit predates its repository license file; the text above comes from the
maintainer's later canonical license. Radix's package records omit `gitHead`; all five packages share
the repository's pinned canonical license. The Geist font software's OFL-1.1 remains separately
vendored at `licenses/geist-OFL-1.1.txt`.
