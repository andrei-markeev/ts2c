#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

typedef short int16_t;

#define ARRAY(T) struct {\
    int16_t size;\
    int16_t capacity;\
    T *data;\
} *
#define ARRAY_CREATE(array, init_capacity, init_size) {\
    array = malloc(sizeof(*array)); \
    array->data = malloc((init_capacity) * sizeof(*array->data)); \
    assert(array->data != NULL); \
    array->capacity = init_capacity; \
    array->size = init_size; \
}
#define ARRAY_PUSH(array, item) {\
    if (array->size == array->capacity) {  \
        array->capacity *= 2;  \
        array->data = realloc(array->data, array->capacity * sizeof(*array->data)); \
        assert(array->data != NULL); \
    }  \
    array->data[array->size++] = item; \
}

struct array_pointer_t {
    int16_t size;
    int16_t capacity;
    void ** data;
};

struct gray_t {
    struct array_number_t * data;
    int16_t height;
    int16_t width;
};
struct imageSrc_t {
    int16_t height;
    int16_t width;
    int16_t data[40];
};
struct array_number_t {
    int16_t size;
    int16_t capacity;
    int16_t* data;
};

static struct array_pointer_t *gc_main;
static int16_t gc_i;

static ARRAY(struct array_pointer_t *) gc_main_arrays;
static struct imageSrc_t * colorImage;
static struct gray_t * grayImage;
static int16_t i;

struct gray_t * gray(struct imageSrc_t * imageSrc)
{
    struct gray_t * imageDst;
    struct array_number_t * tmp_array = NULL;
    int16_t i;

    ARRAY_CREATE(tmp_array, 2, 0);
    ARRAY_PUSH(gc_main_arrays, (void *)tmp_array);
    imageDst = malloc(sizeof(*imageDst));
    assert(imageDst != NULL);
    ARRAY_PUSH(gc_main, (void *)imageDst);
    imageDst->data = tmp_array;
    imageDst->height = imageSrc->height;
    imageDst->width = imageSrc->width;
    i = 0;
    for (;i < 40;(i = i + 4))
        ARRAY_PUSH(imageDst->data, (imageSrc->data[i] * 299 + imageSrc->data[i + 1] * 587 + imageSrc->data[i + 2] * 114 + 500) / 1000 & 0xff);
    return imageDst;
}

int main(void) {
    ARRAY_CREATE(gc_main, 2, 0);
    ARRAY_CREATE(gc_main_arrays, 2, 0);

    colorImage = malloc(sizeof(*colorImage));
    assert(colorImage != NULL);
    ARRAY_PUSH(gc_main, (void *)colorImage);
    colorImage->height = 10;
    colorImage->width = 1;
    colorImage->data[0] = 227;
    colorImage->data[1] = 219;
    colorImage->data[2] = 4;
    colorImage->data[3] = 255;
    colorImage->data[4] = 227;
    colorImage->data[5] = 220;
    colorImage->data[6] = 4;
    colorImage->data[7] = 255;
    colorImage->data[8] = 227;
    colorImage->data[9] = 219;
    colorImage->data[10] = 4;
    colorImage->data[11] = 255;
    colorImage->data[12] = 227;
    colorImage->data[13] = 220;
    colorImage->data[14] = 4;
    colorImage->data[15] = 255;
    colorImage->data[16] = 227;
    colorImage->data[17] = 219;
    colorImage->data[18] = 4;
    colorImage->data[19] = 255;
    colorImage->data[20] = 227;
    colorImage->data[21] = 220;
    colorImage->data[22] = 4;
    colorImage->data[23] = 255;
    colorImage->data[24] = 227;
    colorImage->data[25] = 219;
    colorImage->data[26] = 4;
    colorImage->data[27] = 255;
    colorImage->data[28] = 227;
    colorImage->data[29] = 220;
    colorImage->data[30] = 4;
    colorImage->data[31] = 255;
    colorImage->data[32] = 227;
    colorImage->data[33] = 219;
    colorImage->data[34] = 4;
    colorImage->data[35] = 255;
    colorImage->data[36] = 0;
    colorImage->data[37] = 0;
    colorImage->data[38] = 0;
    colorImage->data[39] = 0;
    grayImage = gray(colorImage);
    printf("[ ");
    for (i = 0; i < grayImage->data->size; i++) {
        if (i != 0)
            printf(", ");
        printf("%d", grayImage->data->data[i]);
    }
    printf(" ]\n");
    for (gc_i = 0; gc_i < gc_main_arrays->size; gc_i++) {
        free(gc_main_arrays->data[gc_i]->data);
        free(gc_main_arrays->data[gc_i]);
    }
    free(gc_main_arrays->data);
    free(gc_main_arrays);

    for (gc_i = 0; gc_i < gc_main->size; gc_i++)
        free(gc_main->data[gc_i]);
    free(gc_main->data);
    free(gc_main);

    return 0;
}
