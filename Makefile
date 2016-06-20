PROJECT="fastrpc-viewer"
VERSION="0.8.1"

CURRENT_DIR=`pwd`
BUILD_DIR="build"
DIST_NAME="${PROJECT}-${VERSION}.xpi"
DIST_PATH="${CURRENT_DIR}/${BUILD_DIR}/${DIST_NAME}"

.PHONY: latest head clean

latest:
	@echo "Building latest '${DIST_PATH}'..."
	@mkdir -p ${BUILD_DIR}
	@zip -r ${DIST_PATH} * -x "${BUILD_DIR}/*" -x "Makefile" -x ".git/*" -x "configure"

head:
	@echo "Building '${DIST_PATH}'..."
	@mkdir -p ${BUILD_DIR}
	@git archive --format=zip -o ${DIST_PATH} HEAD

clean:
	@echo "Removing '${CURRENT_DIR}/${BUILD_DIR}'..."
	@rm -rf ${BUILD_DIR}
