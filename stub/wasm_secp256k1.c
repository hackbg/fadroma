#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/include/secp256k1.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/include/secp256k1_preallocated.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/assumptions.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/checkmem.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/util.h"

#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/field_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/scalar_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/group_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/ecmult_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/ecmult_const_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/ecmult_gen_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/ecdsa_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/eckey_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/hash_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/int128_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/scratch_impl.h"
#include "deps/secp256k1/secp256k1-sys/depend/secp256k1/src/selftest.h"

size_t rustsecp256k1_v0_10_0_context_preallocated_size(unsigned int flags) {
    size_t ret = sizeof(rustsecp256k1_v0_10_0_context);
    /* A return value of 0 is reserved as an indicator for errors when we call this function internally. */
    VERIFY_CHECK(ret != 0);

    if (EXPECT((flags & SECP256K1_FLAGS_TYPE_MASK) != SECP256K1_FLAGS_TYPE_CONTEXT, 0)) {
            rustsecp256k1_v0_10_0_callback_call(&default_illegal_callback,
                                    "Invalid flags");
            return 0;
    }

    if (EXPECT(!SECP256K1_CHECKMEM_RUNNING() && (flags & SECP256K1_FLAGS_BIT_CONTEXT_DECLASSIFY), 0)) {
            rustsecp256k1_v0_10_0_callback_call(&default_illegal_callback,
                                    "Declassify flag requires running with memory checking");
            return 0;
    }

    return ret;
}

size_t rustsecp256k1_v0_10_0_context_preallocated_clone_size(const rustsecp256k1_v0_10_0_context* ctx) {
    VERIFY_CHECK(ctx != NULL);
    ARG_CHECK(rustsecp256k1_v0_10_0_context_is_proper(ctx));
    return sizeof(rustsecp256k1_v0_10_0_context);
}

rustsecp256k1_v0_10_0_context* rustsecp256k1_v0_10_0_context_preallocated_create(void* prealloc, unsigned int flags) {
    size_t prealloc_size;
    rustsecp256k1_v0_10_0_context* ret;

    rustsecp256k1_v0_10_0_selftest();

    prealloc_size = rustsecp256k1_v0_10_0_context_preallocated_size(flags);
    if (prealloc_size == 0) {
        return NULL;
    }
    VERIFY_CHECK(prealloc != NULL);
    ret = (rustsecp256k1_v0_10_0_context*)prealloc;
    ret->illegal_callback = default_illegal_callback;
    ret->error_callback = default_error_callback;

    /* Flags have been checked by rustsecp256k1_v0_10_0_context_preallocated_size. */
    VERIFY_CHECK((flags & SECP256K1_FLAGS_TYPE_MASK) == SECP256K1_FLAGS_TYPE_CONTEXT);
    rustsecp256k1_v0_10_0_ecmult_gen_context_build(&ret->ecmult_gen_ctx);
    ret->declassify = !!(flags & SECP256K1_FLAGS_BIT_CONTEXT_DECLASSIFY);

    return ret;
}

rustsecp256k1_v0_10_0_context* rustsecp256k1_v0_10_0_context_preallocated_clone(const rustsecp256k1_v0_10_0_context* ctx, void* prealloc) {
    rustsecp256k1_v0_10_0_context* ret;
    VERIFY_CHECK(ctx != NULL);
    ARG_CHECK(prealloc != NULL);
    ARG_CHECK(rustsecp256k1_v0_10_0_context_is_proper(ctx));

    ret = (rustsecp256k1_v0_10_0_context*)prealloc;
    *ret = *ctx;
    return ret;
}

void rustsecp256k1_v0_10_0_context_preallocated_destroy(rustsecp256k1_v0_10_0_context* ctx) {
    ARG_CHECK_VOID(ctx == NULL || rustsecp256k1_v0_10_0_context_is_proper(ctx));

    /* Defined as noop */
    if (ctx == NULL) {
        return;
    }

    rustsecp256k1_v0_10_0_ecmult_gen_context_clear(&ctx->ecmult_gen_ctx);
}
