#include "secp256k1.c"

/*#include "secp256k1.h"*/
/*#include "secp256k1_preallocated.h"*/
/*#include "assumptions.h"*/
/*#include "checkmem.h"*/
/*#include "util.h"*/

/*extern size_t rustsecp256k1_v0_10_0_context_preallocated_size(unsigned int flags); */

/*size_t rustsecp256k1_v0_10_0_context_preallocated_clone_size(const rustsecp256k1_v0_10_0_context* ctx) {*/
    /*VERIFY_CHECK(ctx != NULL);*/
    /*ARG_CHECK(rustsecp256k1_v0_10_0_context_is_proper(ctx));*/
    /*return sizeof(rustsecp256k1_v0_10_0_context);*/
/*}*/

/*rustsecp256k1_v0_10_0_context* rustsecp256k1_v0_10_0_context_preallocated_create(void* prealloc, unsigned int flags) {*/
    /*size_t prealloc_size;*/
    /*rustsecp256k1_v0_10_0_context* ret;*/

    /*rustsecp256k1_v0_10_0_selftest();*/

    /*prealloc_size = rustsecp256k1_v0_10_0_context_preallocated_size(flags);*/
    /*if (prealloc_size == 0) {*/
        /*return NULL;*/
    /*}*/
    /*VERIFY_CHECK(prealloc != NULL);*/
    /*ret = (rustsecp256k1_v0_10_0_context*)prealloc;*/
    /*ret->illegal_callback = default_illegal_callback;*/
    /*ret->error_callback = default_error_callback;*/

    /*[> Flags have been checked by rustsecp256k1_v0_10_0_context_preallocated_size. <]*/
    /*VERIFY_CHECK((flags & SECP256K1_FLAGS_TYPE_MASK) == SECP256K1_FLAGS_TYPE_CONTEXT);*/
    /*rustsecp256k1_v0_10_0_ecmult_gen_context_build(&ret->ecmult_gen_ctx);*/
    /*ret->declassify = !!(flags & SECP256K1_FLAGS_BIT_CONTEXT_DECLASSIFY);*/

    /*return ret;*/
/*}*/

/*rustsecp256k1_v0_10_0_context* rustsecp256k1_v0_10_0_context_preallocated_clone(const rustsecp256k1_v0_10_0_context* ctx, void* prealloc) {*/
    /*rustsecp256k1_v0_10_0_context* ret;*/
    /*VERIFY_CHECK(ctx != NULL);*/
    /*ARG_CHECK(prealloc != NULL);*/
    /*ARG_CHECK(rustsecp256k1_v0_10_0_context_is_proper(ctx));*/

    /*ret = (rustsecp256k1_v0_10_0_context*)prealloc;*/
    /**ret = *ctx;*/
    /*return ret;*/
/*}*/

/*void rustsecp256k1_v0_10_0_context_preallocated_destroy(rustsecp256k1_v0_10_0_context* ctx) {*/
    /*ARG_CHECK_VOID(ctx == NULL || rustsecp256k1_v0_10_0_context_is_proper(ctx));*/

    /*[> Defined as noop <]*/
    /*if (ctx == NULL) {*/
        /*return;*/
    /*}*/

    /*rustsecp256k1_v0_10_0_ecmult_gen_context_clear(&ctx->ecmult_gen_ctx);*/
/*}*/
